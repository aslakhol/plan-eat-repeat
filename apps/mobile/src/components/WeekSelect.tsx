import { format } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react-native";
import { View, Text } from "react-native";
import { Button } from "./ui/Button";

type WeekSelectProps = {
  setWeekOffSet: React.Dispatch<React.SetStateAction<number>>;
  startOfDisplayedWeek: Date;
};

export function WeekSelect({
  setWeekOffSet,
  startOfDisplayedWeek,
}: WeekSelectProps) {
  return (
    <View className="flex-row items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onPress={() => setWeekOffSet((prev) => prev - 1)}
        className="h-9 w-9 items-center justify-center p-0"
      >
        <ChevronLeft size={16} color="hsl(24, 10%, 10%)" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onPress={() => setWeekOffSet(0)}
        className="h-9 w-9 items-center justify-center p-0"
      >
        <Calendar size={16} color="hsl(24, 10%, 10%)" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onPress={() => setWeekOffSet((prev) => prev + 1)}
        className="h-9 w-9 items-center justify-center p-0"
      >
        <ChevronRight size={16} color="hsl(24, 10%, 10%)" />
      </Button>
      <Text className="px-2 text-sm font-medium text-foreground">
        Week {format(startOfDisplayedWeek, "w, MMMM, yyyy")}
      </Text>
    </View>
  );
}
