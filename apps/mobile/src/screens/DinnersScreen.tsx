import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { DinnerWithTags } from "@planeatrepeat/shared";
import { api } from "../utils/api";
import { Screen } from "../components/Screen";
import { Filter } from "../components/Filter";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { DinnerForm } from "../components/dinners/DinnerForm";
import { colors } from "../theme/colors";

type DinnersScreenProps = {
  navigation: any;
  route: { params?: { openNew?: boolean; dinnerId?: number } };
};

export function DinnersScreen({ navigation, route }: DinnersScreenProps) {
  const dinnersQuery = api.dinner.dinners.useQuery();
  const utils = api.useUtils();

  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [selectedDinner, setSelectedDinner] = useState<DinnerWithTags | null>(
    null,
  );

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["85%"], []);

  const createDinnerMutation = api.dinner.create.useMutation({
    onSuccess: () => {
      void utils.dinner.dinners.invalidate();
      bottomSheetRef.current?.dismiss();
    },
  });

  const updateDinnerMutation = api.dinner.edit.useMutation({
    onSuccess: () => {
      void utils.dinner.dinners.invalidate();
      bottomSheetRef.current?.dismiss();
    },
  });

  const deleteDinnerMutation = api.dinner.delete.useMutation({
    onSuccess: () => {
      void utils.dinner.dinners.invalidate();
      bottomSheetRef.current?.dismiss();
    },
  });

  const openNewDinner = () => {
    setSelectedDinner(null);
    bottomSheetRef.current?.present();
  };

  const openDinner = (dinner: DinnerWithTags) => {
    setSelectedDinner(dinner);
    bottomSheetRef.current?.present();
  };

  useEffect(() => {
    if (route.params?.openNew) {
      openNewDinner();
      navigation.setParams({ openNew: undefined });
    }
    if (route.params?.dinnerId && dinnersQuery.data?.dinners) {
      const dinner = dinnersQuery.data.dinners.find(
        (d) => d.id === route.params?.dinnerId,
      );
      if (dinner) {
        openDinner(dinner);
        navigation.setParams({ dinnerId: undefined });
      }
    }
  }, [route.params, dinnersQuery.data, navigation]);

  const dinners = dinnersQuery.data?.dinners
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

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop appearsOnIndex={0} disappearsOnIndex={-1} {...props} />
  );

  return (
    <Screen>
      <View className="gap-4">
        <View className="gap-2">
          <Text className="font-serif text-3xl font-bold text-foreground">
            Dinners
          </Text>
          <Filter
            search={search}
            setSearch={setSearch}
            showTags={showTags}
            setShowTags={setShowTags}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
          />
        </View>

        {dinnersQuery.isPending ? (
          <View className="h-[50vh] items-center justify-center">
            <Text className="text-muted-foreground">Loading dinners...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
            <Pressable onPress={openNewDinner}>
              <Card className="border-dashed bg-transparent">
                <CardContent className="items-center gap-2 py-6">
                  <Text className="text-sm font-medium text-muted-foreground">
                    Add new dinner
                  </Text>
                </CardContent>
              </Card>
            </Pressable>

            {dinners?.map((dinner) => (
              <Pressable key={dinner.id} onPress={() => openDinner(dinner)}>
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {dinner.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-row flex-wrap gap-2">
                    {dinner.tags.map((tag) => (
                      <Badge key={tag.value} variant="secondary">
                        {tag.value}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.mutedForeground }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        >
          <View className="gap-4">
            <Text className="font-serif text-2xl font-semibold text-foreground">
              {selectedDinner ? "Edit dinner" : "New dinner"}
            </Text>
            <DinnerForm
              existingDinner={selectedDinner}
              onCancel={() => bottomSheetRef.current?.dismiss()}
              isPending={
                createDinnerMutation.isPending ||
                updateDinnerMutation.isPending ||
                deleteDinnerMutation.isPending
              }
              onSubmit={(values) => {
                if (selectedDinner) {
                  updateDinnerMutation.mutate({
                    dinnerId: selectedDinner.id,
                    dinnerName: values.name,
                    tagList: values.tags,
                    link: values.link,
                    notes: values.notes,
                  });
                } else {
                  createDinnerMutation.mutate({
                    dinnerName: values.name,
                    tagList: values.tags,
                    link: values.link,
                    notes: values.notes,
                  });
                }
              }}
              onDelete={
                selectedDinner
                  ? () =>
                      deleteDinnerMutation.mutate({
                        dinnerId: selectedDinner.id,
                      })
                  : undefined
              }
            />
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </Screen>
  );
}
