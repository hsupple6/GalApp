export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

// Define the command types
export type CommandId = string;

// Define the command handler type
export type CommandHandler = (...args: any[]) => any;

export interface Command {
  id: CommandId;
  description: string;
  systemPromptAddition?: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
  handler: CommandHandler;
}
