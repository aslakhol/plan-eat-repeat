import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { ChefHat } from "lucide-react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppTabsParamList } from "../navigation/AppTabs";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { api } from "../utils/api";
import { Screen } from "../components/Screen";
import { Filter } from "../components/Filter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { colors } from "../theme/colors";
import { cn } from "../utils/cn";

type DinnersScreenProps = BottomTabScreenProps<AppTabsParamList, "Dinners">;

export function DinnersScreen({ navigation }: DinnersScreenProps) {
  const dinnersQuery = api.dinner.dinners.useQuery();

  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);

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

  return (
    <Screen edges={["top", "left", "right"]}>
      <View className="flex-1 gap-4">
        <View className="gap-2">
          <Text className="text-foreground font-serif text-3xl">Dinners</Text>
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
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <>
            <View
              accessible
              accessibilityLabel="capture-ready-dinners"
              style={styles.captureMarker}
            />
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
            >
              <Pressable
                onPress={() =>
                  navigation
                    .getParent<NativeStackNavigationProp<RootStackParamList>>()
                    ?.navigate("NewDinner")
                }
              >
                <Card className="min-h-[100px] border-dashed bg-transparent">
                  <CardContent className="flex-1 items-center justify-center gap-2 p-4">
                    <ChefHat size={24} color={colors.mutedForeground} />
                    <Text className="text-muted-foreground text-sm font-medium">
                      Add new dinner
                    </Text>
                  </CardContent>
                </Card>
              </Pressable>

              {dinners?.map((dinner) => (
                <Pressable
                  key={dinner.id}
                  onPress={() =>
                    navigation
                      .getParent<
                        NativeStackNavigationProp<RootStackParamList>
                      >()
                      ?.navigate("DinnerDetail", { dinnerId: dinner.id })
                  }
                >
                  <Card className="bg-card min-h-[100px]">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle
                        className="text-base leading-tight"
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {dinner.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-row flex-wrap gap-2 p-4 pt-2">
                      {dinner.tags.map((tag) => (
                        <Badge
                          key={tag.value}
                          variant="secondary"
                          className={cn(
                            "border border-transparent",
                            selectedTags.includes(tag.value) &&
                              "border-primary bg-primary/10",
                          )}
                        >
                          {tag.value}
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  captureMarker: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
