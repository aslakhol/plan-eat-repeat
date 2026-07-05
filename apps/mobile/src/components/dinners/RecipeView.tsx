import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { ExternalLink } from "lucide-react-native";
import { formatAmount, type DinnerWithRecipe } from "@planeatrepeat/shared";
import { Button } from "../ui/Button";

type Props = {
  dinner: DinnerWithRecipe;
  onEdit: () => void;
};

const sourceLabel = (link: string) => {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
};

export function RecipeView({ dinner, onEdit }: Props) {
  const hasRecipe = dinner.parts.length > 0;

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 40,
      }}
    >
      <View className="gap-3">
        <Text
          className="text-foreground font-serif text-[26px] leading-[31px]"
          selectable
        >
          {dinner.name}
        </Text>

        {dinner.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5">
            {dinner.tags.map((tag) => (
              <View
                key={tag.value}
                className="border-border rounded-full border bg-white px-2.5 py-[3px]"
              >
                <Text className="text-muted-foreground text-xs font-semibold">
                  {tag.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {(dinner.link !== null || dinner.servings !== null) && (
          <View className="flex-row flex-wrap items-center gap-2">
            {dinner.link && (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(dinner.link ?? "")}
                className="flex-row items-center gap-1 py-1"
              >
                <Text className="text-sm font-semibold text-[hsl(18,75%,45%)]">
                  {sourceLabel(dinner.link)}
                </Text>
                <ExternalLink size={14} color="hsl(18, 75%, 45%)" />
              </Pressable>
            )}
            {dinner.link && dinner.servings && (
              <Text className="text-[hsl(40,15%,78%)]">·</Text>
            )}
            {dinner.servings && (
              <Text className="text-muted-foreground text-sm font-medium">
                {dinner.servings} servings
              </Text>
            )}
          </View>
        )}
      </View>

      {hasRecipe ? (
        <View className="mt-6">
          {dinner.parts.map((part, partIndex) => {
            const amounts = part.ingredients.map((ingredient) =>
              [
                ingredient.amount === null
                  ? ""
                  : formatAmount(ingredient.amount),
                ingredient.unit ?? "",
              ]
                .filter(Boolean)
                .join(" "),
            );
            // Size the amount column to the part's longest amount so short
            // amounts sit close to the names; drop the column entirely when
            // no ingredient in the part has one.
            const longestAmount = Math.max(
              0,
              ...amounts.map((amount) => amount.length),
            );
            const amountWidth = Math.min(104, Math.ceil(longestAmount * 9.5));

            return (
              <View
                key={part.id}
                className={
                  partIndex > 0
                    ? "mt-[26px] border-t border-[hsl(40,15%,86%)] pt-5"
                    : undefined
                }
              >
                {part.name && (
                  <Text className="text-foreground font-serif text-xl">
                    {part.name}
                  </Text>
                )}

                {part.ingredients.length > 0 && (
                  <View className={part.name ? "mt-2.5" : undefined}>
                    {part.ingredients.map((ingredient, ingredientIndex) => (
                      <View
                        key={ingredient.id}
                        className="flex-row gap-2.5 py-0.5"
                      >
                        {amountWidth > 0 && (
                          <Text
                            className="text-foreground text-base font-bold leading-[21px]"
                            style={{ width: amountWidth }}
                          >
                            {amounts[ingredientIndex]}
                          </Text>
                        )}
                        <Text className="text-foreground min-w-0 flex-1 text-base font-medium leading-[21px]">
                          {ingredient.name}
                          {ingredient.note && (
                            <Text className="text-muted-foreground font-normal">
                              {" "}
                              — {ingredient.note}
                            </Text>
                          )}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {part.steps.length > 0 && (
                  <View className="mt-3 gap-[5px]">
                    {part.steps.map((step, stepIndex) => (
                      <View key={step.id} className="flex-row gap-2">
                        <Text className="w-[22px] font-serif text-base leading-[22px] text-[hsl(18,75%,50%)]">
                          {stepIndex + 1}
                        </Text>
                        <Text className="text-foreground min-w-0 flex-1 text-base font-medium leading-[22px]">
                          {step.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View className="mt-8 items-start">
          <Button onPress={onEdit}>Add recipe</Button>
        </View>
      )}

      {dinner.notes && (
        <View className="mt-[26px] border-t border-[hsl(40,15%,86%)] pt-5">
          <Text className="text-foreground mb-1.5 font-serif text-base">
            Notes
          </Text>
          <Text
            className="text-[15px] font-medium leading-[23px] text-[hsl(24,10%,25%)]"
            selectable
          >
            {dinner.notes}
          </Text>
        </View>
      )}

      {!hasRecipe && !dinner.notes && (
        <Text className="text-muted-foreground mt-5 text-sm">
          Add ingredients and steps whenever you’re ready.
        </Text>
      )}
    </ScrollView>
  );
}
