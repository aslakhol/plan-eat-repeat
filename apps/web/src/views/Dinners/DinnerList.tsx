import Link from "next/link";
import { cn } from "../../lib/utils";
import { type DinnerWithTags } from "../../utils/types";
import { ChefHat } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

type Props = {
  dinners: DinnerWithTags[];
  selectedTags: string[];
};

export const DinnerList = ({ dinners, selectedTags }: Props) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <Link href="/dinners/new" className="block h-full">
        <Card className="hover:border-primary/50 hover:bg-accent/50 flex h-full min-h-[100px] cursor-pointer flex-col items-center justify-center border-dashed bg-transparent transition-colors">
          <CardContent className="text-muted-foreground hover:text-primary flex h-full flex-col items-center justify-center gap-2 p-4">
            <ChefHat className="h-6 w-6 sm:h-8 sm:w-8" />
            <span className="text-sm font-medium sm:text-base">
              Add new dinner
            </span>
          </CardContent>
        </Card>
      </Link>
      {dinners.map((dinner) => (
        <Link
          key={dinner.id}
          href={`/dinners/${dinner.id}`}
          className="block h-full"
        >
          <Card className="hover:bg-accent/50 flex h-full min-h-[100px] cursor-pointer flex-col justify-between transition-colors">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="line-clamp-2 font-serif text-base font-medium leading-tight sm:text-lg">
                {dinner.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="flex flex-wrap gap-2">
                {dinner.tags.map((tag) => (
                  <Badge
                    key={tag.value}
                    variant="secondary"
                    className={cn(
                      selectedTags.includes(tag.value) &&
                        "border-primary bg-primary/10 border",
                    )}
                  >
                    {tag.value}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};
