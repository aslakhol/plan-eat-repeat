// Source: https://craft.mxkaske.dev/post/fancy-multi-select

// MIT License

// Copyright (c) 2024 Maximilian Kaske

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import * as React from "react";
import { X } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";

import { Command, CommandList, CommandGroup, CommandItem } from "./command";
import { Badge } from "./badge";

type FancyComboboxOptions = Record<"value" | "label", string>;

export const FancyCombobox = ({
  placeholder,
  options,
  selected,
  select,
  unselect,
  removeLast,
  createNew,
}: {
  placeholder?: string;
  options: FancyComboboxOptions[];
  selected: FancyComboboxOptions[];
  select: (option: FancyComboboxOptions) => void;
  unselect: (option: FancyComboboxOptions) => void;
  removeLast: () => void;
  createNew: (value: string) => void;
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const selectables = options.filter(
    (option) => !selected.map((s) => s.value).includes(option.value),
  );

  const handleUnselect = React.useCallback(
    (option: FancyComboboxOptions) => {
      unselect(option);
    },
    [unselect],
  );

  const handleCreateNew = React.useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || selected.map((s) => s.value).includes(trimmedValue)) {
      setInputValue("");
      return;
    }
    createNew(trimmedValue);
    setInputValue("");
  }, [inputValue, selected, createNew]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      if (input) {
        if (e.key === "Delete" || e.key === "Backspace") {
          if (input.value === "") {
            removeLast();
          }
        }
        if (
          e.key === "Enter" &&
          inputValue.trim() &&
          selectables.length === 0
        ) {
          e.preventDefault();
          e.stopPropagation();
          handleCreateNew();
        }
        // This is not a default behaviour of the <input /> field
        if (e.key === "Escape") {
          input.blur();
        }
      }
    },
    [inputValue, selectables.length, removeLast, handleCreateNew],
  );

  return (
    <Command
      onKeyDown={handleKeyDown}
      className="overflow-visible bg-transparent"
    >
      <div className="group rounded-md border border-input px-3 py-2 text-base ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <div className="flex flex-wrap gap-1">
          {selected.map((option) => {
            return (
              <Badge key={option.value} variant="secondary">
                {option.label}
                <button
                  className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUnselect(option);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => handleUnselect(option)}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            );
          })}
          {/* Avoid having the "Search" Icon */}
          <CommandPrimitive.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="ml-2 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="relative mt-2">
        <CommandList>
          {open && (selectables.length || inputValue.trim()) ? (
            <div className="absolute top-0 z-10 max-h-[35vh] w-full overflow-scroll rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
              <CommandGroup className="pb-0">
                {selectables.map((option) => {
                  return (
                    <CommandItem
                      key={option.value}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={() => {
                        setInputValue("");
                        select(option);
                      }}
                      className={"cursor-pointer"}
                    >
                      {option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup className="pt-0">
                {inputValue.trim() && (
                  <CommandItem
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onSelect={handleCreateNew}
                    className="cursor-pointer"
                  >
                    Add &ldquo;{inputValue}&rdquo;
                  </CommandItem>
                )}
              </CommandGroup>
            </div>
          ) : null}
        </CommandList>
      </div>
    </Command>
  );
};
