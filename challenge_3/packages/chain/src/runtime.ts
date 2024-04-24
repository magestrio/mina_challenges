import { ModulesConfig } from "@proto-kit/common";
import { MessageModule } from "./message";
import { Balance } from "@proto-kit/library";
import { Balances } from "./balances";

export const modules = {
  MessageModule,
  Balances
};

export const config: ModulesConfig<typeof modules> = {
  MessageModule: {},
  Balances: {
    totalSupply: Balance.from(10_000),
  },
};

export default {
  modules,
  config,
};
