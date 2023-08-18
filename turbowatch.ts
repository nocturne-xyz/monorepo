import { defineConfig, type ChangeEvent } from "turbowatch";

export default defineConfig({
  debounce: {
    wait: 5000,
  },
  project: __dirname,
  triggers: [
    {
      expression: ["match", "*.ts", "basename"],
      name: "watch",
      onChange: async ({ spawn }: ChangeEvent) => {
        await spawn`yarn turbo run dev`;
      },
      persistent: true,
      retry: {
        retries: 3,
      },
    },
  ],
});
