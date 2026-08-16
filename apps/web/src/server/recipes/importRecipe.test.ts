import assert from "node:assert/strict";
import { after, mock, test } from "node:test";

const originalFetch = globalThis.fetch;

after(() => {
  globalThis.fetch = originalFetch;
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

void test("URL imports preserve structured and visible Recipe evidence", async () => {
  extractedText = "";
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

  globalThis.fetch = mock.fn(() =>
    Promise.resolve(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=UTF-8" },
      }),
    ),
  );

  await importRecipeFromUrl("https://example.com/soup");

  assert.match(extractedText, /"recipeIngredient":"chicken, stock"/);
  assert.match(extractedText, /9 dl chicken stock/);
  assert.match(extractedText, /Fry the onion until soft/);
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
