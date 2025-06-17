import { ClaudeTool, Command, CommandId } from 'types/commands';
import { CommandHandler } from 'types/commands';
import { create } from 'zustand';

// Define the command registry state
interface CommandRegistryState {
  commands: Map<CommandId, CommandHandler>;
}

// Define the command registry store
interface CommandRegistryStore extends CommandRegistryState {
  registerCommand: (id: CommandId, handler: CommandHandler) => void;
  unregisterCommand: (id: CommandId) => void;
  executeCommand: <T>(id: CommandId, ...args: any[]) => Promise<T | undefined>;
}

// Create the command registry store
export const useCommandRegistryStore = create<CommandRegistryStore>((set, get) => ({
  commands: new Map(),

  registerCommand: (id: CommandId, handler: CommandHandler) => {
    set((state) => {
      const newCommands = new Map(state.commands);
      newCommands.set(id, handler);
      return { commands: newCommands };
    });
  },

  unregisterCommand: (id: CommandId) => {
    set((state) => {
      const newCommands = new Map(state.commands);
      newCommands.delete(id);
      return { commands: newCommands };
    });
  },

  executeCommand: async <T>(id: CommandId, ...args: any[]): Promise<T | undefined> => {
    const { commands } = get();
    const handler = commands.get(id);
    
    if (handler) {
      try {
        return await handler(args[0]);
      } catch (error) {
        console.error(`Error executing command ${id}:`, error);
        return undefined;
      }
    } else {
      console.warn(`Command ${id} not found`);
      return undefined;
    }
  },
}));

// Helper function to execute commands with type safety
// export const executeCommand = async <T>(id: CommandId, ...args: any[]): Promise<T | undefined> => {
//   return useCommandRegistryStore.getState().executeCommand<T>(id, ...args);
// };


export const createToolsFromCommands = (commands: Command[]): ClaudeTool[] => {
  return commands.map(command => ({
    name: command.id,
    description: command.description,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(
        command.parameters.map(param => [
          param.name,
          {
            type: param.type,
            description: param.description
          }
        ])
      ),
      required: command.parameters
        .filter(param => param.required)
        .map(param => param.name)
    }
  }));
};

export const registerCommands = (commands: Command[]) => {
  const commandRegistry = useCommandRegistryStore.getState();
  commands.forEach(command => {
    commandRegistry.registerCommand(command.id, command.handler);
  });
};
