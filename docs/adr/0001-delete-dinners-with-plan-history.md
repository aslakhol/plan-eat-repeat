# Delete Dinners with their Plan Slots

Deleting a Dinner permanently deletes all of its past and future Plan Slots, including its Cooking History. We chose hard deletion over archiving or historical snapshots because history for a deliberately deleted Dinner is not needed, and keeping it would add persistent states and query complexity throughout the Cookbook and Week planner. The confirmation must warn that the Dinner's history will be lost.
