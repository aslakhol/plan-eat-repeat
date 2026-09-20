import Link from "next/link";
import { useRouter } from "next/router";
import {
  BookOpen,
  Calendar,
  ShoppingCart,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "~/components/ResponsiveModal";

export function Welcome({ onClose }: { onClose: () => void }) {
  return (
    <ResponsiveModal open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent
        className="h-auto max-h-[90dvh] gap-0 rounded-t-xl p-5 outline-none sm:max-w-[460px] sm:rounded-xl sm:p-6"
        scrollViewport
      >
        <div>
          <div className="mb-1 flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-8 rounded-full"
              onClick={onClose}
              aria-label="Close welcome"
            >
              <X className="size-4" />
            </Button>
          </div>
          <WelcomeNote onClose={onClose} />
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function WelcomeNote({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const navigate = async (href: string) => {
    if (await router.push(href)) onClose();
  };

  return (
    <div className="px-1 pb-2 pt-2 sm:px-3">
      <ResponsiveModalHeader className="!text-left">
        <ResponsiveModalTitle className="pr-5 font-serif text-[28px] font-normal leading-tight tracking-normal">
          Welcome to
          <br />
          Plan Eat Repeat
        </ResponsiveModalTitle>
        <ResponsiveModalDescription className="text-foreground !mt-4 text-sm leading-relaxed">
          Thanks for giving our app a try. We built it to help our little family
          in day-to-day life and we hope it can help you too!
        </ResponsiveModalDescription>
      </ResponsiveModalHeader>

      <div className="my-7 space-y-5">
        <div className="flex gap-4">
          <BookOpen
            className="text-primary mt-1 size-5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-serif text-lg">
              <Link
                href="/dinners"
                onNavigate={(event) => {
                  event.preventDefault();
                  void navigate("/dinners");
                }}
                className="hover:text-primary focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2"
              >
                Cookbook
              </Link>
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Keep recipes and everyday dinners. Import from links, Instagram or
              photos.
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <Calendar
            className="text-primary mt-1 size-5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-serif text-lg">
              <Link
                href="/"
                onNavigate={(event) => {
                  event.preventDefault();
                  void navigate("/");
                }}
                className="hover:text-primary focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2"
              >
                Dinner plan
              </Link>
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Plan the week and look back at what you cooked.
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <ShoppingCart
            className="text-primary mt-1 size-5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-serif text-lg">
              <Link
                href="/shopping-list"
                onNavigate={(event) => {
                  event.preventDefault();
                  void navigate("/shopping-list");
                }}
                className="hover:text-primary focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2"
              >
                Shopping list
              </Link>
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Add groceries or ingredients from your recipes. Check them off as
              you shop or send them to Oda.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 text-sm leading-relaxed">
        <p>
          If you have any ideas for us, or find something broken or annoying,
          please let us know.
        </p>
        <p className="mt-3 flex items-center gap-2 font-medium">
          <UtensilsCrossed
            className="text-primary size-4 shrink-0"
            aria-hidden="true"
          />
          Aslak and Madeleine
        </p>
      </div>
      <Button className="h-11 w-full" onClick={onClose}>
        Have a look around
      </Button>
    </div>
  );
}
