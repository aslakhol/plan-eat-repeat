import { useRouter } from "next/router";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import Link from "next/link";

export const BottomNav = () => {
  const router = useRouter();

  return (
    <div className="pb-20">
      <div className="fixed bottom-0 flex w-full justify-around border-t bg-white">
        <Button
          variant={"link"}
          className={cn(
            "w-full py-8 text-xl",
            router.asPath === "/" && "underline",
          )}
          asChild
        >
          <Link href="/">Plan</Link>
        </Button>
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
      </div>
    </div>
  );
};
