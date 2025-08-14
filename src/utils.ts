import { workspace } from "vscode";

export const getConfig = () => {
  return workspace.getConfiguration("itsc2214");
};

export const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
