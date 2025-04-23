// // File Path: packages/ui-tars/sdk/src/tests/Model.test.ts

// import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// import { UITarsModel, UITarsModelConfig } from '../src/Model'; // Adjust path relative to test file
// import { InvokeParams, InvokeOutput } from '../src/types'; // Adjust path
// import { useContext, setContext } from '../src/context/useContext'; // Adjust path
// import {
//   UITarsModelVersion,
//   Conversation,
//   PredictionParsed,
// } from '@ui-tars/shared/types'; // Adjust path if necessary
// import * as Utils from '../src/utils'; // Import to mock functions inside it
// import type { OpenAI as OpenAIClient } from 'openai'; // Import type for mocking
// import type { ChatCompletion } from 'openai/resources/chat/completions'; // Import specific type

// // --- Mocks ---

// // Mock dependencies obtained via useContext
// const mockLogger = {
//   log: vi.fn(),
//   error: vi.fn(),
//   warn: vi.fn(),
//   info: vi.fn(),
// };
// const mockGetCurrentServerSessionId = vi.fn<() => string | null>(); // Mock function for getting ID
// const mockSetServerSessionId = vi.fn<(id: string | null) => void>(); // Mock function for setting ID

// // Mock utility functions imported and used by invoke
// // Use vi.doMock for hoisted mocking if needed, or vi.mock
// vi.mock('../utils', async (importOriginal) => {
//   const actual = await importOriginal<typeof Utils>();
//   return {
//     ...actual, // Keep actual implementations unless needed to mock
//     preprocessResizeImage: vi.fn((img) => Promise.resolve(img)), // Simple async mock
//     convertToOpenAIMessages: vi.fn(() => [
//       { role: 'user', content: 'mock message to send' },
//     ]), // Simple mock
//   };
// });

// // --- Test Setup ---

// // Define minimal config needed to instantiate the model
// const testModelConfig: UITarsModelConfig = {
//   baseURL: 'http://mock-server.test',
//   apiKey: 'test-key',
//   model: 'test-model',
// };

// // Define base parameters for invoke, specific values added in tests
// const baseInvokeParams: Omit<InvokeParams, 'currentServerSessionId'> = {
//   conversations: [{ from: 'human', value: 'Initial instruction' }],
//   images: ['mockBase64Image'],
//   uiTarsVersion: UITarsModelVersion.V1_0, // Use an actual enum value
// };

// // Helper to create mock ChatCompletion response object
// const createMockCompletion = (
//   sessionId: string | null,
//   actions: PredictionParsed[],
// ): ChatCompletion => {
//   const payload = { session_id: sessionId, actions: actions };
//   const contentString = JSON.stringify(payload); // Server puts JSON string in content
//   return {
//     id: 'chatcmpl-mock-' + Math.random(),
//     object: 'chat.completion',
//     created: Date.now(),
//     model: 'mock-model',
//     choices: [
//       {
//         index: 0,
//         message: { role: 'assistant', content: contentString },
//         finish_reason: 'stop',
//         logprobs: null,
//       },
//     ],
//     // Add usage or other fields if necessary for type compatibility
//     usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
//   } as ChatCompletion; // Type assertion might be needed depending on mock structure
// };

// describe('UITarsModel', () => {
//   let model: UITarsModel;
//   // Use vi.spyOn to mock the protected method on the prototype
//   // We spy on it AFTER creating the instance usually, or patch its prototype
//   let invokeModelProviderSpy: ReturnType<typeof vi.spyOn>;

//   beforeEach(() => {
//     // Create a new model instance for each test
//     model = new UITarsModel(testModelConfig);

//     // Set up the mock context for each test
//     // Ensure the context provides the functions our invoke method expects
//     setContext({
//       logger: mockLogger,
//       signal: undefined,
//       getCurrentServerSessionId: mockGetCurrentServerSessionId,
//       setServerSessionId: mockSetServerSessionId,
//       // Mock other context properties if needed by other methods
//     } as any);

//     // Spy on the protected method AFTER instance creation
//     // Need 'any' because it's protected
//     invokeModelProviderSpy = vi.spyOn(model as any, 'invokeModelProvider');
//   });

//   afterEach(() => {
//     // Clear mocks state (call history, implementations) after each test
//     vi.restoreAllMocks(); // This resets spies and mocks set up with vi.spyOn or vi.mock
//     // Reset mocks created with vi.fn() if needed (though restoreAllMocks might cover spies on them)
//     mockGetCurrentServerSessionId.mockClear();
//     mockSetServerSessionId.mockClear();
//   });

//   // --- Test Cases ---

//   describe('invoke method - Session ID Handling', () => {
//     it('should send request WITHOUT X-Session-ID header on first request', async () => {
//       // Arrange: No current session ID in context
//       mockGetCurrentServerSessionId.mockReturnValue(null);
//       const newServerId = 'server-gen-id-1';
//       const mockActions: PredictionParsed[] = [];
//       const mockResponse = createMockCompletion(newServerId, mockActions);
//       invokeModelProviderSpy.mockResolvedValue(mockResponse); // Mock the provider call

//       // Act
//       await model.invoke({ ...baseInvokeParams });

//       // Assert: Check options passed to invokeModelProvider
//       expect(invokeModelProviderSpy).toHaveBeenCalled();
//       const callOptions = invokeModelProviderSpy.mock
//         .calls[0][1] as OpenAIClient.RequestOptions; // Second argument is options
//       expect(callOptions.headers?.['X-Session-ID']).toBeUndefined(); // Check header specifically
//     });

//     it('should send request WITH X-Session-ID header on subsequent requests', async () => {
//       // Arrange: Existing session ID in context
//       const existingId = 'session-123-abc';
//       mockGetCurrentServerSessionId.mockReturnValue(existingId);
//       const mockActions: PredictionParsed[] = [];
//       // Server should return the same ID it received
//       const mockResponse = createMockCompletion(existingId, mockActions);
//       invokeModelProviderSpy.mockResolvedValue(mockResponse);

//       // Act
//       await model.invoke({ ...baseInvokeParams });

//       // Assert: Check options passed to invokeModelProvider
//       expect(invokeModelProviderSpy).toHaveBeenCalled();
//       const callOptions = invokeModelProviderSpy.mock
//         .calls[0][1] as OpenAIClient.RequestOptions;
//       expect(callOptions.headers).toBeDefined();
//       expect(callOptions.headers?.['X-Session-ID']).toBe(existingId);
//     });

//     it('should extract and store received session ID from response content JSON via context', async () => {
//       // Arrange: No current session ID initially
//       mockGetCurrentServerSessionId.mockReturnValue(null);
//       const serverReturnedId = 'new-session-from-server-xyz';
//       const mockActions: PredictionParsed[] = [
//         { type: 'click', params: {} } as any,
//       ];
//       const mockResponse = createMockCompletion(serverReturnedId, mockActions);
//       invokeModelProviderSpy.mockResolvedValue(mockResponse);

//       // Act
//       await model.invoke({ ...baseInvokeParams });

//       // Assert: Check if setServerSessionId (from context) was called with the correct ID
//       expect(mockSetServerSessionId).toHaveBeenCalledTimes(1);
//       expect(mockSetServerSessionId).toHaveBeenCalledWith(serverReturnedId);
//     });

//     it('should reset server session ID via context if JSON parsing fails', async () => {
//       // Arrange
//       mockGetCurrentServerSessionId.mockReturnValue('old-session-id');
//       const malformedJsonString = 'this is not { json';
//       // Mock the return value of the provider to contain malformed content
//       const mockCompletionResult = {
//         choices: [{ message: { content: malformedJsonString } }],
//       };
//       invokeModelProviderSpy.mockResolvedValue(mockCompletionResult as any); // Use type assertion for partial mock

//       // Act
//       await model.invoke({ ...baseInvokeParams });

//       // Assert: setServerSessionId should be called with null based on implemented error handling
//       expect(mockSetServerSessionId).toHaveBeenCalledTimes(1);
//       expect(mockSetServerSessionId).toHaveBeenCalledWith(null);
//     });

//     it('should not call setServerSessionId if response payload lacks session_id', async () => {
//       // Arrange
//       mockGetCurrentServerSessionId.mockReturnValue('old-session-id');
//       const jsonStringWithoutId = JSON.stringify({
//         actions: [{ type: 'click' }],
//       }); // Missing session_id
//       const mockCompletionResult = {
//         choices: [{ message: { content: jsonStringWithoutId } }],
//       };
//       invokeModelProviderSpy.mockResolvedValue(mockCompletionResult as any);

//       // Act
//       await model.invoke({ ...baseInvokeParams });

//       // Assert: setServerSessionId should NOT have been called to store a new valid ID
//       expect(mockSetServerSessionId).not.toHaveBeenCalled(); // It might be called with null in error handling, but not with a new ID
//     });
//   });

//   describe('invoke method - Action Parsing from JSON', () => {
//     it('should correctly parse actions array from response content JSON', async () => {
//       // Arrange
//       const expectedActions: PredictionParsed[] = [
//         { type: 'type', params: { text: 'abc' } } as any,
//         { type: 'wait', params: {} } as any,
//       ];
//       const serverReturnedId = 'sid-789';
//       const mockResponse = createMockCompletion(
//         serverReturnedId,
//         expectedActions,
//       );
//       invokeModelProviderSpy.mockResolvedValue(mockResponse);
//       mockGetCurrentServerSessionId.mockReturnValue(null); // Initial request

//       // Act
//       const output: InvokeOutput = await model.invoke({ ...baseInvokeParams });

//       // Assert
//       expect(output.parsedPredictions).toEqual(expectedActions); // Verify actions array
//       expect(output.prediction).toEqual(
//         JSON.stringify({
//           session_id: serverReturnedId,
//           actions: expectedActions,
//         }),
//       ); // Verify raw prediction string
//     });

//     it('should return empty parsedPredictions if actions key is missing in payload', async () => {
//       // Arrange
//       const serverReturnedId = 'sid-abc';
//       const responseJsonString = JSON.stringify({
//         session_id: serverReturnedId,
//       }); // Missing actions key
//       const mockCompletionResult = {
//         choices: [{ message: { content: responseJsonString } }],
//       };
//       invokeModelProviderSpy.mockResolvedValue(mockCompletionResult as any);
//       mockGetCurrentServerSessionId.mockReturnValue(null);

//       // Act
//       const output: InvokeOutput = await model.invoke({ ...baseInvokeParams });

//       // Assert
//       expect(output.parsedPredictions).toEqual([]);
//       expect(output.prediction).toEqual(responseJsonString);
//     });

//     it('should return empty parsedPredictions if content is not valid JSON', async () => {
//       // Arrange
//       const invalidJsonString = 'Thought: Do stuff. Action: click()'; // Not JSON
//       const mockCompletionResult = {
//         choices: [{ message: { content: invalidJsonString } }],
//       };
//       invokeModelProviderSpy.mockResolvedValue(mockCompletionResult as any);
//       mockGetCurrentServerSessionId.mockReturnValue(null);

//       // Act
//       const output: InvokeOutput = await model.invoke({ ...baseInvokeParams });

//       // Assert
//       expect(output.parsedPredictions).toEqual([]); // Expect empty array due to parse failure
//       expect(output.prediction).toEqual(invalidJsonString);
//       expect(mockLogger.error).toHaveBeenCalledWith(
//         // Check error logging
//         expect.stringContaining(
//           'Failed to parse prediction content as JSON/JSON5',
//         ),
//         expect.any(String),
//         expect.any(Error),
//       );
//     });
//   });
// });
