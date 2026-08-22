import Link from "next/link";
import React from "react";

import { Card } from "~/components/ui/card";
import { type PublicDinnerList } from "~/lib/public-dinner-list";
import { publishedDinnerPath } from "~/lib/published-dinner";

const sharedDinnerCount = (count: number) =>
  `${count} ${count === 1 ? "dinner" : "dinners"} shared`;

export const PublicDinnerListView = ({
  dinnerList,
}: {
  dinnerList: PublicDinnerList;
}) => (
  <div className="min-h-screen bg-[#f2efe8] md:bg-[#faf8f5]">
    <header className="border-border hidden h-[82px] items-center border-b px-8 md:flex">
      <span className="text-primary font-serif text-2xl">Plan Eat Repeat</span>
    </header>

    <main className="mx-auto max-w-[824px] px-4 pb-8 pt-7 md:px-8 md:py-12">
      <div className="text-primary mb-6 font-serif text-2xl md:hidden">
        Plan Eat Repeat
      </div>

      <section className="border-border rounded-2xl border bg-white px-5 py-7 shadow-[0_8px_28px_rgba(60,50,40,.08)] md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none">
        <header className="border-border flex items-center gap-3 border-b pb-6">
          <span className="bg-primary/15 text-primary flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold">
            {dinnerList.householdName.trim().charAt(0).toUpperCase() || "P"}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-3xl font-normal">
              {dinnerList.householdName}
            </h1>
            <p className="text-muted-foreground mt-1 text-xs font-bold">
              {sharedDinnerCount(dinnerList.dinners.length)}
            </p>
          </div>
        </header>

        <div className="mt-6 grid gap-2.5 md:grid-cols-3">
          {dinnerList.dinners.map((dinner) => (
            <Link
              key={dinner.publicSlug}
              href={publishedDinnerPath(dinner.publicSlug)}
              className="min-w-0"
            >
              <Card className="hover:bg-secondary/40 h-full min-h-[86px] px-3.5 py-3 shadow-none transition-colors">
                <h2 className="font-serif text-[17px] leading-tight">
                  {dinner.name}
                </h2>
                {dinner.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dinner.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-muted-foreground rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  </div>
);
