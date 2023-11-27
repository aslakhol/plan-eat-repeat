import { api } from "~/utils/api";
import { Dinners } from "../Dinners";
import { Button } from "../../components/ui/button";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { useRouter } from "next/router";

export const DinnersView = () => {
  const dinnerQuery = api.dinner.dinners.useQuery();
  const router = useRouter();

  return (
    <div className="grid h-screen">
      <div className="pb-20">
        {dinnerQuery.data?.dinners && (
          <Dinners dinners={dinnerQuery.data.dinners} />
        )}
      </div>
      <div className="fixed bottom-0 flex w-full justify-around border-t bg-white">
        <Button
          variant={"link"}
          className={cn(
            "w-full py-8 text-xl",
            router.asPath === "/dinners" && "underline",
          )}
          asChild
        >
          <Link href="/dinners">Dinners</Link>
        </Button>
        <Button
          variant={"link"}
          className={cn(
            "w-full py-8 text-xl",
            router.asPath === "/" && "underline",
          )}
          asChild
        >
          <Link href="/">Week</Link>
        </Button>
      </div>
    </div>
  );
};
