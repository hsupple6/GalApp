# space chat data flow as of 4/2/2025


## Basic message sending flow

Here's a concise explanation of the message sending flow:

1. **Message Initiation**
- User triggers send in `SpaceChat.tsx`
- Calls `sendMessage` action from `chatStore.ts`

2. **Message Creation & Storage**
- `chatStore.ts` uses `messageUtils.ts` to create a new `MessageEntity`
- Message is persisted using `entityService.ts`
- Messages are linked to a `ThreadEntity` (defined in `types/chat.ts`)

3. **AI Response Streaming**
- `streamHelpers.ts` handles streaming response from AI
- Creates an AI response message
- Two possible paths:

4a. **Normal Response Path**
- AI responds with text
- Response is added to message content
- Conversation continues

4b. **Tool Use Path**
- If AI requests tool use:
  1. Tool use content is added to message
  2. `pendingToolMessageId` is set
  3. `SpaceChat.tsx` detects change via useEffect
  4. Executes tool command via `commandRegistryStore.ts`
  5. Tool result passed to `handleToolResult` in `chatStore.ts`
  6. `handleToolResult` calls `sendMessage` again with tool result
  7. AI continues conversation with tool result

The flow maintains message history in threads, with each message being a `MessageEntity` linked to a `ThreadEntity`, allowing for organized conversation management and tool interactions.


## Context:

**Context & Message Flow:**
1. `contextStore.ts`:
- Maintains the current space context (window contents, selections)
- Subscribes to `spaceStore` to track window changes
- Provides context data for AI messages

2. `contextUtils.ts`:
- Helper functions to transform window data into context
- Creates structured window content based on app type (docs, notes)
- Used by `contextStore` to process window data

3. `commandRegistryStore.ts`:
- Central registry for all available commands
- Provides tools to AI based on context
- Handles command execution when AI requests tool use

**Message Send Flow:**
```
SpaceChat.tsx
→ Gets context from contextStore
→ Sends to chatStore
→ streamHelpers uses context to filter relevant tools from commandRegistryStore
```

**Window Content Flow:**
```
DocsApp (or other apps)
→ Updates window state in spaceStore
→ contextStore (subscribed to spaceStore)
→ Uses contextUtils to process window data
→ Updates context for AI
```

This architecture ensures:
- AI always has current context from active windows
- Only relevant tools are provided based on context
- Apps maintain their state independently
- Context is automatically updated when windows change

