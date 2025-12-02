import { createContext, useContext } from "react";

export interface FormContextValue {
  form: Record<string, string>;
  updateForm: (name: string, value: string) => void;
  executeAction: (actionName: string) => Promise<void>;
  isPublishing: boolean;
}

export const FormContext = createContext<FormContextValue>({
  form: {},
  updateForm: () => {},
  executeAction: async () => {},
  isPublishing: false,
});

export const useForm = () => useContext(FormContext);
