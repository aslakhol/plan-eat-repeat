# Keep the Mobile Web Drawer Shell Non-Scrolling

Mobile web drawers keep Vaul's `Drawer.Content` as a non-scrolling shell, while explicit child viewports own content scrolling. This preserves Vaul's drag-gap background, keeps the drag handle fixed, and prevents Vaul's two-drawer-height `::after` filler from becoming blank scrollable space. The invariant applies to every web `ResponsiveModal` drawer; each surface may choose which controls remain outside its scrolling viewport, and the native Expo bottom sheets remain outside this decision.
