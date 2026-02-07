import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Plus } from "lucide-react-native";
import {
  addDays,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { keepPreviousData } from "@tanstack/react-query";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { DinnerWithTags } from "@planeatrepeat/shared";
import { api } from "../utils/api";
import { cn } from "../utils/cn";
import { Screen } from "../components/Screen";
import { WeekSelect } from "../components/WeekSelect";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Filter } from "../components/Filter";
import { colors } from "../theme/colors";

type SheetMode = "plan" | "planned";

export function PlanScreen({ navigation }: { navigation: any }) {
  // TODO: Add PostHog tracking + wake lock parity after the core flows settle.
  const [weekOffSet, setWeekOffSet] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDinner, setSelectedDinner] = useState<DinnerWithTags | null>(
    null,
  );
  const [sheetMode, setSheetMode] = useState<SheetMode>("plan");
  const [search, setSearch] = useState("");
  const [showTags, setShowTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["80%"], []);

  const trpc = api.useUtils();
  const startOfCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const startOfDisplayedWeek = addDays(startOfCurrentWeek, weekOffSet * 7);

  const week: Date[] = [
    startOfDay(startOfDisplayedWeek),
    startOfDay(addDays(startOfDisplayedWeek, 1)),
    startOfDay(addDays(startOfDisplayedWeek, 2)),
    startOfDay(addDays(startOfDisplayedWeek, 3)),
    startOfDay(addDays(startOfDisplayedWeek, 4)),
    startOfDay(addDays(startOfDisplayedWeek, 5)),
    startOfDay(addDays(startOfDisplayedWeek, 6)),
  ];

  const plannedDinnersQuery = api.plan.plannedDinners.useQuery(
    { startOfWeek: startOfDisplayedWeek },
    { placeholderData: keepPreviousData },
  );

  void trpc.plan.plannedDinners.prefetch(
    { startOfWeek: addDays(startOfDisplayedWeek, 7) },
    { staleTime: 60 * 1000 },
  );
  void trpc.plan.plannedDinners.prefetch(
    { startOfWeek: addDays(startOfDisplayedWeek, -7) },
    { staleTime: 60 * 1000 },
  );

  const dinnersQuery = api.dinner.dinners.useQuery();

  const planDinnerForDateMutation = api.plan.planDinnerForDate.useMutation({
    onSuccess: () => {
      void trpc.plan.plannedDinners.invalidate();
    },
  });

  const unplanDayMutation = api.plan.unplanDay.useMutation({
    onSuccess: () => {
      void trpc.plan.plannedDinners.invalidate();
      bottomSheetRef.current?.dismiss();
    },
  });

  const openSheet = useCallback(
    (date: Date, dinner?: DinnerWithTags) => {
      setSelectedDate(date);
      setSelectedDinner(dinner ?? null);
      setSheetMode(dinner ? "planned" : "plan");
      setSearch("");
      setSelectedTags([]);
      setShowTags(false);
      bottomSheetRef.current?.present();
    },
    [setSelectedDate],
  );

  const filteredDinners = dinnersQuery.data?.dinners
    .filter(
      (dinner) =>
        !search || dinner.name.toLowerCase().includes(search.toLowerCase()),
    )
    .filter(
      (dinner) =>
        selectedTags.length === 0 ||
        selectedTags.every((tag) =>
          dinner.tags.map((t) => t.value).includes(tag),
        ),
    );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop appearsOnIndex={0} disappearsOnIndex={-1} {...props} />
    ),
    [],
  );

  const planDinner = (dinnerId: number) => {
    if (!selectedDate) return;
    planDinnerForDateMutation.mutate({ date: selectedDate, dinnerId });
    bottomSheetRef.current?.dismiss();
  };

  const surpriseMe = () => {
    if (!filteredDinners?.length) return;
    const randomDinner =
      filteredDinners[Math.floor(Math.random() * filteredDinners.length)];
    if (randomDinner) {
      planDinner(randomDinner.id);
    }
  };

  return (
    <Screen contentClassName="relative">
      <View className="gap-4">
        <View className="gap-2">
          <Text className="font-serif text-3xl font-bold text-foreground">
            Weekly Plan
          </Text>
        </View>

        {plannedDinnersQuery.isPending ? (
          <View className="h-[50vh] items-center justify-center">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 120, gap: 8 }}>
            {week.map((day) => {
              const plannedDinner =
                plannedDinnersQuery.data?.plans.find((p) =>
                  isSameDay(p.date, day),
                )?.dinner;
              return (
                <DayCard
                  key={day.toString()}
                  date={day}
                  plannedDinner={plannedDinner}
                  onPress={() => openSheet(day, plannedDinner)}
                />
              );
            })}
          </ScrollView>
        )}
      </View>

      <View className="absolute bottom-20 left-0 right-0 items-center px-4">
        <View className="rounded-lg border border-border bg-background/95 px-3 py-2 shadow-lg">
          <WeekSelect
            setWeekOffSet={setWeekOffSet}
            startOfDisplayedWeek={startOfDisplayedWeek}
          />
        </View>
      </View>

      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.mutedForeground }}
      >
        {sheetMode === "plan" ? (
          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          >
            <View className="gap-4">
              <View className="gap-1">
                <Text className="text-sm text-muted-foreground">
                  {selectedDate ? format(selectedDate, "EEEE, LLLL do, y") : ""}
                </Text>
                <Text className="font-serif text-2xl font-semibold text-foreground">
                  {selectedDinner?.name ?? "Nothing planned yet"}
                </Text>
              </View>

              <Filter
                search={search}
                setSearch={setSearch}
                showTags={showTags}
                setShowTags={setShowTags}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
              />

              <View className="gap-2">
                {filteredDinners?.map((dinner) => (
                  <Button
                    key={dinner.id}
                    variant="outline"
                    onPress={() => planDinner(dinner.id)}
                    disabled={planDinnerForDateMutation.isPending}
                    className={cn(
                      "justify-start",
                      selectedDinner?.id === dinner.id &&
                        "bg-accent/50 text-accent-foreground",
                    )}
                  >
                    <Text
                      className={cn(
                        "text-foreground",
                        selectedDinner?.id === dinner.id &&
                          "text-accent-foreground",
                      )}
                    >
                      {dinner.name}
                    </Text>
                  </Button>
                ))}
              </View>

              <View className="flex-row flex-wrap gap-2">
                <Button
                  variant="outline"
                  onPress={() => {
                    bottomSheetRef.current?.dismiss();
                    navigation.navigate("Dinners", { openNew: true });
                  }}
                >
                  New dinner
                </Button>
                <Button
                  variant="outline"
                  onPress={surpriseMe}
                  disabled={!filteredDinners?.length}
                >
                  Surprise me!
                </Button>
                {selectedDate && selectedDinner && (
                  <Button
                    variant="outline"
                    onPress={() =>
                      unplanDayMutation.mutate({ date: selectedDate })
                    }
                    disabled={unplanDayMutation.isPending}
                  >
                    Clear day
                  </Button>
                )}
              </View>
            </View>
          </BottomSheetScrollView>
        ) : (
          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          >
            <View className="gap-4">
              <View className="gap-1">
                <Text className="text-sm text-muted-foreground">
                  {selectedDate ? format(selectedDate, "EEEE, LLLL do, y") : ""}
                </Text>
                <Text className="font-serif text-2xl font-semibold text-foreground">
                  {selectedDinner?.name ?? ""}
                </Text>
              </View>

              <View className="gap-3">
                {!!selectedDinner?.tags.length && (
                  <View className="flex-row flex-wrap gap-2">
                    {selectedDinner.tags.map((tag) => (
                      <Badge key={tag.value} variant="secondary">
                        {tag.value}
                      </Badge>
                    ))}
                  </View>
                )}

                {!!selectedDinner?.link && (
                  <Pressable
                    onPress={() => Linking.openURL(selectedDinner.link ?? "")}
                  >
                    <Text className="text-sm text-blue-600 underline">
                      {selectedDinner.link}
                    </Text>
                  </Pressable>
                )}

                {!!selectedDinner?.notes && (
                  <View className="gap-1">
                    {selectedDinner.notes.split("\n").map((line) => (
                      <Text key={line} className="text-sm text-foreground">
                        {line}
                      </Text>
                    ))}
                  </View>
                )}

                <View className="flex-row flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onPress={() => setSheetMode("plan")}
                  >
                    Change plan
                  </Button>
                  {selectedDate && (
                    <Button
                      variant="outline"
                      onPress={() =>
                        unplanDayMutation.mutate({ date: selectedDate })
                      }
                      disabled={unplanDayMutation.isPending}
                    >
                      Clear day
                    </Button>
                  )}
                  {selectedDinner && (
                    <Button
                      variant="outline"
                      onPress={() => {
                        bottomSheetRef.current?.dismiss();
                        navigation.navigate("Dinners", {
                          dinnerId: selectedDinner.id,
                        });
                      }}
                    >
                      Edit dinner
                    </Button>
                  )}
                </View>
              </View>
            </View>
          </BottomSheetScrollView>
        )}
      </BottomSheetModal>
    </Screen>
  );
}

type DayCardProps = {
  date: Date;
  plannedDinner?: DinnerWithTags;
  onPress: () => void;
};

function DayCard({ date, plannedDinner, onPress }: DayCardProps) {
  const isDateToday = isToday(date);

  return (
    <Pressable onPress={onPress}>
      <View
        className={cn(
          isDateToday && "rounded-lg border-2 border-primary bg-background p-[2px]",
        )}
      >
        <Card
          className={cn(
            "min-h-[80px] overflow-hidden",
            !plannedDinner && "border-dashed bg-transparent",
            plannedDinner && "border-secondary bg-secondary/30",
          )}
        >
          <CardHeader className="p-3 pb-1">
            <Text
              className={cn(
                "text-sm font-medium text-muted-foreground",
                isDateToday && "font-bold text-primary",
              )}
            >
              {format(date, "EEE do")}
            </Text>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            {plannedDinner ? (
              <Text
                className="font-serif text-base font-medium text-foreground"
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {plannedDinner.name}
              </Text>
            ) : (
              <View className="items-center justify-center">
                <Plus size={24} color={colors.mutedForeground} />
              </View>
            )}
          </CardContent>
        </Card>
      </View>
    </Pressable>
  );
}
