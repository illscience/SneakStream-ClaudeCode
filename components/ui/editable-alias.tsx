"use client";

import { Editable } from "@ark-ui/react/editable";
import { Edit3, Check, X } from "lucide-react";

interface EditableAliasProps {
  value: string;
  onSubmit: (value: string) => void;
  placeholder?: string;
}

export default function EditableAlias({ value, onSubmit, placeholder = "Enter your alias..." }: EditableAliasProps) {
  console.log("EditableAlias render - value:", value);

  return (
    <Editable.Root
      key={value}
      placeholder={placeholder}
      defaultValue={value}
      onValueCommit={(details) => {
        console.log("onValueCommit called - details:", details);
        console.log("Original value:", value, "New value:", details.value);
        if (details.value.trim() && details.value !== value) {
          console.log("Calling onSubmit with:", details.value);
          onSubmit(details.value);
        } else {
          console.log("Not calling onSubmit - value unchanged or empty");
        }
      }}
    >
      <div className="flex items-start space-x-3">
        <Editable.Area className="flex-1">
          <Editable.Input className="w-full px-0 py-2 text-4xl font-bold border border-lime-400 rounded-lg bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-lime-400 transition-colors pl-4" />
          <Editable.Preview className="w-full px-0 py-2 text-4xl font-bold border border-transparent rounded-lg text-white hover:border-lime-400/50 cursor-text transition-colors" />
        </Editable.Area>
        <Editable.Context>
          {(editable) => (
            <Editable.Control className="flex items-center space-x-2 mt-2">
              {editable.editing ? (
                <>
                  <Editable.SubmitTrigger
                    className="p-2 text-black bg-lime-400 hover:bg-lime-300 rounded-full transition-colors"
                    onClick={() => console.log("Submit button clicked")}
                  >
                    <Check className="h-5 w-5" />
                  </Editable.SubmitTrigger>
                  <Editable.CancelTrigger className="p-2 text-white bg-zinc-700 hover:bg-zinc-600 rounded-full transition-colors">
                    <X className="h-5 w-5" />
                  </Editable.CancelTrigger>
                </>
              ) : (
                <Editable.EditTrigger
                  className="p-2 text-black bg-lime-400 hover:bg-lime-300 rounded-full transition-colors"
                  onClick={() => console.log("Edit button clicked")}
                >
                  <Edit3 className="h-5 w-5" />
                </Editable.EditTrigger>
              )}
            </Editable.Control>
          )}
        </Editable.Context>
      </div>
    </Editable.Root>
  );
}
