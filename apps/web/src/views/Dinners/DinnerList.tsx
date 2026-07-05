import Link from "next/link";
import { cn } from "../../lib/utils";
import { type DinnerWithTags } from "../../utils/types";
import { NewDinner } from "./NewDinner";
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
      <NewDinner />
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
