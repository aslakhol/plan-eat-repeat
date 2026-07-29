import * as React from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from "@planeatrepeat/web";

export const HouseholdSettings = () => {
  const form = useForm({
    defaultValues: {
      name: "The Hollunds",
      slug: "the-hollunds",
      importInstructions: "",
    },
  });

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Edit household</CardTitle>
        <CardDescription>
          Everyone in the household shares these dinners and this week&apos;s
          plan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(() => undefined)}
            className="space-y-8"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Household name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Household slug</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    The slug identifies your household. It is part of the URL
                    for your invitations.
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="importInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipe import instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      maxLength={1000}
                      placeholder="Keep steps short and explain techniques for beginners"
                    />
                  </FormControl>
                  <FormDescription>
                    Shape every imported recipe.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between">
              <Button type="submit" variant="outline">
                Save changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export const SingleField = () => {
  const form = useForm({ defaultValues: { name: "" } });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => undefined)}
        className="max-w-sm space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dinner name</FormLabel>
              <FormControl>
                <Input placeholder="Tomato pasta" {...field} />
              </FormControl>
              <FormDescription>
                This is what you will see in the weekly plan.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save dinner</Button>
      </form>
    </Form>
  );
};

export const WithValidationError = () => {
  const form = useForm({ defaultValues: { name: "Th", link: "matprat" } });

  React.useEffect(() => {
    form.setError("name", { message: "Name must be at least 3 characters" });
    form.setError("link", { message: "Enter a valid URL" });
  }, [form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => undefined)}
        className="max-w-sm space-y-6"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Household name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="link"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipe link</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>Optional — where you found it.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline">
          Save changes
        </Button>
      </form>
    </Form>
  );
};
