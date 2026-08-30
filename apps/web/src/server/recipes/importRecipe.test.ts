import assert from "node:assert/strict";
import { after, mock, test } from "node:test";

const originalFetch = globalThis.fetch;
const originalSupadataApiKey = process.env.SUPADATA_API_KEY;
const originalSkipEnvValidation = process.env.SKIP_ENV_VALIDATION;

process.env.SUPADATA_API_KEY = "test-supadata-key";
process.env.SKIP_ENV_VALIDATION = "1";

after(() => {
  globalThis.fetch = originalFetch;
  if (originalSupadataApiKey === undefined) {
    delete process.env.SUPADATA_API_KEY;
  } else {
    process.env.SUPADATA_API_KEY = originalSupadataApiKey;
  }
  if (originalSkipEnvValidation === undefined) {
    delete process.env.SKIP_ENV_VALIDATION;
  } else {
    process.env.SKIP_ENV_VALIDATION = originalSkipEnvValidation;
  }
});

let extractedText = "";

mock.module(new URL("../ai/extractRecipe.ts", import.meta.url).href, {
  namedExports: {
    extractRecipe: (input: {
      parts: Array<{ type: "text"; text: string }>;
    }) => {
      extractedText = input.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      return Promise.resolve({
        name: "Soup",
        recipe: { servings: null, parts: [] },
      });
    },
  },
});

const { importRecipeFromUrl } = await import("./importRecipe");

const spendLog = () => {
  const events: Array<string | number> = [];
  return {
    events,
    observer: {
      onOperationStarted: () => {
        events.push("started");
      },
      onCreditsKnown: (credits: number) => {
        events.push(credits);
      },
    },
  };
};

const requestUrl = (input: string | URL | Request) =>
  new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );

const abortReason = (signal?: AbortSignal | null) =>
  signal?.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted", "AbortError");

void test("blocked pages fall back to one Supadata web scrape", async () => {
  extractedText = "";
  const spend = spendLog();
  const requests: URL[] = [];
  const markdown = [
    "# Tomato soup",
    "## Ingredients",
    "- 800 g tomatoes",
    "- 5 dl vegetable stock",
    "## Instructions",
    "Simmer for 20 minutes and blend.",
  ].join("\n");

  globalThis.fetch = mock.fn((input: string | URL | Request) => {
    const url = requestUrl(input);
    requests.push(url);
    if (url.hostname === "example.com") {
      return Promise.resolve(new Response("Blocked", { status: 403 }));
    }
    if (url.pathname === "/v1/web/scrape") {
      return Promise.resolve(
        Response.json({
          url: "https://example.com/tomato-soup",
          content: markdown,
          countCharacters: markdown.length,
          urls: [],
        }),
      );
    }
    return Promise.reject(new Error(`Unexpected request to ${url.origin}`));
  }) as typeof fetch;

  await importRecipeFromUrl(
    "https://example.com/tomato-soup",
    undefined,
    undefined,
    undefined,
    spend.observer,
  );

  assert.equal(extractedText, markdown);
  assert.deepEqual(
    requests.map(({ hostname, pathname }) => `${hostname}${pathname}`),
    ["example.com/tomato-soup", "api.supadata.ai/v1/web/scrape"],
  );
  assert.equal(
    requests[1]?.searchParams.get("url"),
    "https://example.com/tomato-soup",
  );
  assert.deepEqual(spend.events, ["started", 1]);
});

for (const failure of [
  {
    name: "failed page fetches",
    response: () => new Response("Unavailable", { status: 500 }),
  },
  {
    name: "pages without readable HTML",
    response: () =>
      new Response("not html", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
  },
] as const) {
  void test(`${failure.name} fall back to one Supadata web scrape`, async () => {
    extractedText = "";
    let pageRequests = 0;
    let scrapeRequests = 0;

    globalThis.fetch = mock.fn((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.hostname === "example.com") {
        pageRequests += 1;
        return Promise.resolve(failure.response());
      }
      if (url.pathname === "/v1/web/scrape") {
        scrapeRequests += 1;
        return Promise.resolve(
          Response.json({
            url: "https://example.com/chowder",
            content: "# Chowder\n\n## Ingredients\n\n500 g potatoes",
            countCharacters: 44,
            urls: [],
          }),
        );
      }
      return Promise.reject(new Error("Unexpected request"));
    }) as typeof fetch;

    await importRecipeFromUrl("https://example.com/chowder");

    assert.match(extractedText, /500 g potatoes/);
    assert.equal(pageRequests, 1);
    assert.equal(scrapeRequests, 1);
  });
}

void test("a successfully read non-recipe does not call Supadata", async () => {
  extractedText = "";
  const spend = spendLog();
  const requests: URL[] = [];
  const prose = "This is a travel article about a long train journey. ".repeat(
    12,
  );

  globalThis.fetch = mock.fn((input: string | URL | Request) => {
    const url = requestUrl(input);
    requests.push(url);
    return Promise.resolve(
      new Response(
        `<!doctype html><html><head><title>Train journey</title></head><body><article><h1>Train journey</h1><p>${prose}</p></article></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      ),
    );
  }) as typeof fetch;

  await assert.rejects(
    importRecipeFromUrl(
      "https://example.com/train-journey",
      undefined,
      undefined,
      undefined,
      spend.observer,
    ),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "NO_RECIPE_FOUND",
  );
  assert.deepEqual(
    requests.map(({ hostname }) => hostname),
    ["example.com"],
  );
  assert.equal(extractedText, "");
  assert.deepEqual(spend.events, []);
});

void test("a Supadata limit replaces the original page failure", async () => {
  let scrapeRequests = 0;
  globalThis.fetch = mock.fn((input: string | URL | Request) => {
    const url = requestUrl(input);
    if (url.hostname === "example.com") {
      return Promise.resolve(new Response("Blocked", { status: 403 }));
    }
    scrapeRequests += 1;
    return Promise.resolve(
      Response.json(
        { error: "limit-exceeded", message: "Limit exceeded" },
        { status: 429 },
      ),
    );
  }) as typeof fetch;

  await assert.rejects(
    importRecipeFromUrl("https://example.com/limited"),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "IMPORT_LIMIT_REACHED",
  );
  assert.equal(scrapeRequests, 1);
});

void test("other Supadata failures preserve the original page error", async () => {
  globalThis.fetch = mock.fn((input: string | URL | Request) => {
    const url = requestUrl(input);
    if (url.hostname === "example.com") {
      return Promise.resolve(new Response("Blocked", { status: 403 }));
    }
    return Promise.resolve(
      Response.json(
        { error: "internal-error", message: "Provider failed" },
        { status: 500 },
      ),
    );
  }) as typeof fetch;

  await assert.rejects(
    importRecipeFromUrl("https://example.com/provider-failed"),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "SITE_BLOCKED",
  );
});

void test("caller cancellation stops an in-flight Supadata fallback", async () => {
  const controller = new AbortController();
  const cancellation = new Error("caller stopped importing");
  let scrapeStarted = false;

  globalThis.fetch = mock.fn(
    (input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.hostname === "example.com") {
        return Promise.resolve(new Response("Blocked", { status: 403 }));
      }
      scrapeStarted = true;
      if (init?.signal?.aborted) {
        return Promise.reject(abortReason(init.signal));
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(abortReason(init.signal)),
          { once: true },
        );
      });
    },
  ) as typeof fetch;

  const importing = importRecipeFromUrl(
    "https://example.com/cancelled",
    undefined,
    controller.signal,
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.abort(cancellation);

  await assert.rejects(importing, (error: unknown) => error === cancellation);
  assert.equal(scrapeStarted, true);
});

void test("Supadata Markdown is capped before recipe extraction", async () => {
  extractedText = "";
  const markdown = `# Long recipe\n${"ingredient and instruction\n".repeat(2_000)}`;

  globalThis.fetch = mock.fn((input: string | URL | Request) => {
    const url = requestUrl(input);
    if (url.hostname === "example.com") {
      return Promise.resolve(new Response("Blocked", { status: 403 }));
    }
    return Promise.resolve(
      Response.json({
        url: "https://example.com/long-recipe",
        content: markdown,
        countCharacters: markdown.length,
        urls: [],
      }),
    );
  }) as typeof fetch;

  await importRecipeFromUrl("https://example.com/long-recipe");

  assert.equal(extractedText.length, 40_000);
  assert.equal(extractedText, markdown.slice(0, 40_000));
});

void test("URL imports preserve structured and visible Recipe evidence", async () => {
  extractedText = "";
  const requests: URL[] = [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: "Soup",
    recipeIngredient: "chicken, stock",
  };
  const html = `<!doctype html>
    <html>
      <head>
        <title>Soup</title>
        <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
      </head>
      <body>
        <article>
          <h1>Soup</h1>
          <p>This warming soup is an easy dinner with chicken and stock.</p>
          <h2>Ingredients</h2>
          <p>4 chicken fillets, cut into bite-sized pieces</p>
          <p>9 dl chicken stock</p>
          <p>2 dl coconut milk</p>
          <h2>Instructions</h2>
          <p>Prepare all the ingredients before starting.</p>
          <p>Fry the onion until soft. Add the chicken and cook until browned.</p>
          <p>Add the stock and simmer the soup for fifteen minutes.</p>
          <p>Stir in the coconut milk, bring the soup back to a gentle boil, and serve.</p>
          <p>The visible page deliberately contains more recipe detail than its structured data.</p>
        </article>
      </body>
    </html>`;

  globalThis.fetch = mock.fn((input: string | URL | Request) => {
    requests.push(requestUrl(input));
    return Promise.resolve(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=UTF-8" },
      }),
    );
  }) as typeof fetch;

  await importRecipeFromUrl("https://example.com/soup");

  assert.match(extractedText, /"recipeIngredient":"chicken, stock"/);
  assert.match(extractedText, /9 dl chicken stock/);
  assert.match(extractedText, /Fry the onion until soft/);
  assert.deepEqual(
    requests.map(({ hostname }) => hostname),
    ["example.com"],
  );
});

void test("URL imports bound structured and visible evidence independently", async () => {
  extractedText = "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: "Soup",
    recipeIngredient: "chicken, stock",
    description: "x".repeat(50_000),
  };
  const html = `<!doctype html>
    <html>
      <head>
        <title>Soup</title>
        <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
      </head>
      <body>
        <article>
          <h1>Soup</h1>
          <p>This warming soup is an easy dinner with chicken and stock.</p>
          <h2>Ingredients</h2>
          <p>4 chicken fillets, cut into bite-sized pieces</p>
          <p>9 dl chicken stock</p>
          <p>2 dl coconut milk</p>
          <h2>Instructions</h2>
          <p>Prepare all the ingredients before starting.</p>
          <p>Fry the onion until soft. Add the chicken and cook until browned.</p>
          <p>Add the stock and simmer the soup for fifteen minutes.</p>
          <p>Stir in the coconut milk, bring the soup back to a gentle boil, and serve.</p>
          <p>The visible page deliberately contains more recipe detail than its structured data.</p>
        </article>
      </body>
    </html>`;

  globalThis.fetch = mock.fn(() =>
    Promise.resolve(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=UTF-8" },
      }),
    ),
  );

  await importRecipeFromUrl("https://example.com/large-structured-data");

  assert.match(extractedText, /"recipeIngredient":"chicken, stock"/);
  assert.match(extractedText, /9 dl chicken stock/);
  assert.match(extractedText, /Fry the onion until soft/);
  assert.ok(extractedText.length <= 40_000);
});

void test("URL imports supplement JSON-LD with readable Recipe content in any language", async () => {
  extractedText = "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: "Zuppa",
    recipeIngredient: "pollo, brodo",
  };
  const html = `<!doctype html>
    <html>
      <head>
        <title>Zuppa</title>
        <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
      </head>
      <body>
        <article>
          <h1>Zuppa</h1>
          <p>Questa zuppa calda è una cena semplice preparata con pollo e brodo.</p>
          <h2>Occorrente</h2>
          <p>Quattro filetti di pollo tagliati a pezzetti.</p>
          <p>Novecento millilitri di brodo di pollo.</p>
          <p>Duecento millilitri di latte di cocco.</p>
          <h2>Procedimento</h2>
          <p>Preparare tutti gli alimenti prima di cominciare.</p>
          <p>Cuocere lentamente la cipolla fino a quando diventa morbida.</p>
          <p>Aggiungere il pollo e continuare la cottura fino a doratura.</p>
          <p>Versare il brodo e lasciare sobbollire la zuppa per quindici minuti.</p>
          <p>Unire il latte di cocco, riportare a leggero bollore e servire subito.</p>
        </article>
      </body>
    </html>`;

  globalThis.fetch = mock.fn(() =>
    Promise.resolve(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=UTF-8" },
      }),
    ),
  );

  await importRecipeFromUrl("https://example.com/zuppa");

  assert.match(extractedText, /"recipeIngredient":"pollo, brodo"/);
  assert.match(extractedText, /Novecento millilitri di brodo di pollo/);
  assert.match(extractedText, /Cuocere lentamente la cipolla/);
});
