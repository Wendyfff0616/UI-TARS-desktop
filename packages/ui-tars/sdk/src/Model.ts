/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import OpenAI, {
  type ClientOptions,
  type OpenAI as OpenAIClient,
} from 'openai';
import {
  type ChatCompletionCreateParamsBase,
  type ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import * as json5 from 'json5';

import { useContext } from './context/useContext';
import type { AgentContext } from './types';
import { Model, type InvokeParams, type InvokeOutput } from './types';

import { preprocessResizeImage, convertToOpenAIMessages } from './utils';
import { DEFAULT_FACTORS } from './constants';
import {
  UITarsModelVersion,
  MAX_PIXELS_V1_0,
  MAX_PIXELS_V1_5,
  MAX_PIXELS_DOUBAO,
} from '@ui-tars/shared/types';

type OpenAIChatCompletionCreateParams = Omit<ClientOptions, 'maxRetries'> &
  Pick<
    ChatCompletionCreateParamsBase,
    'model' | 'max_tokens' | 'temperature' | 'top_p'
  >;

export interface UITarsModelConfig extends OpenAIChatCompletionCreateParams {}

export class UITarsModel extends Model {
  constructor(protected readonly modelConfig: UITarsModelConfig) {
    super();
    this.modelConfig = modelConfig;
  }

  /** [widthFactor, heightFactor] */
  get factors(): [number, number] {
    return DEFAULT_FACTORS;
  }

  get modelName(): string {
    return this.modelConfig.model ?? 'unknown';
  }

  /**
   * call real LLM / VLM Model
   * @param params
   * @param options
   * @returns The full ChatCompletion object from OpenAI library
   */
  protected async invokeModelProvider(
    uiTarsVersion: UITarsModelVersion = UITarsModelVersion.V1_0,
    params: {
      messages: Array<ChatCompletionMessageParam>;
    },
    options: OpenAIClient.RequestOptions & {
      signal?: AbortSignal;
    },
  ): Promise<OpenAIClient.ChatCompletion> {
    const { messages } = params;
    const {
      baseURL,
      apiKey,
      model,
      max_tokens = uiTarsVersion === UITarsModelVersion.V1_5 ? 65535 : 1000,
      temperature = 0,
      top_p = 0.7,
      ...restOptions
    } = this.modelConfig;

    const openai = new OpenAI({
      ...restOptions,
      maxRetries: 0,
      baseURL,
      apiKey,
    });

    // Log the request options being sent, especially headers
    console.log(
      '[UITarsModel.invokeModelProvider] Sending request with options:',
      {
        model,
        messageCount: messages.length,
        stream: false,
        max_tokens,
        temperature,
        top_p,
        headers: options.headers ? JSON.stringify(options.headers) : 'None',
        signal: options.signal ? 'AbortSignal provided' : 'No AbortSignal',
      },
    );

    const result = await openai.chat.completions.create(
      {
        model,
        messages,
        stream: false,
        seed: null,
        stop: null,
        frequency_penalty: null,
        presence_penalty: null,
        max_tokens,
        temperature,
        top_p,
      },
      options,
    );

    return result;
  }

  async invoke(params: InvokeParams): Promise<InvokeOutput> {
    const {
      conversations,
      images = [],
      screenContext,
      scaleFactor,
      uiTarsVersion,
      currentServerSessionId,
    } = params;
    const { logger, signal } = useContext<AgentContext>();

    logger?.info(
      `[UITarsModel] invoke: screenContext=${JSON.stringify(screenContext)}, scaleFactor=${scaleFactor}, uiTarsVersion=${uiTarsVersion}`,
    );

    const maxPixels =
      uiTarsVersion === UITarsModelVersion.V1_5
        ? MAX_PIXELS_V1_5
        : uiTarsVersion === UITarsModelVersion.DOUBAO_1_5_15B ||
            uiTarsVersion === UITarsModelVersion.DOUBAO_1_5_20B
          ? MAX_PIXELS_DOUBAO
          : MAX_PIXELS_V1_0;
    const compressedImages = await Promise.all(
      images.map((image) => preprocessResizeImage(image, maxPixels)),
    );

    const currentServerId = currentServerSessionId;
    logger?.info(
      `[UITarsModel.invoke] Using current Server Session ID from params: ${currentServerId}`,
    );

    const messages = convertToOpenAIMessages({
      conversations,
      images: compressedImages,
    });

    const requestOptions: OpenAIClient.RequestOptions = {};
    if (signal) {
      requestOptions.signal = signal;
    }

    if (currentServerId) {
      requestOptions.headers = { 'X-Session-ID': currentServerId };
      logger?.info(
        `[UITarsModel.invoke] Sending request WITH X-Session-ID: ${currentServerId}`,
      );
    } else {
      logger?.info(
        '[UITarsModel.invoke] Sending request WITHOUT X-Session-ID (first request).',
      );
    }

    const startTime = Date.now();
    let responseContent: string | null = null;
    let parsedActions: any[] = [];
    let receivedSessionId: string | null = null;

    try {
      const completionResult = await this.invokeModelProvider(
        uiTarsVersion,
        { messages },
        requestOptions as any,
      );

      logger?.info(`[UITarsModel cost]: ${Date.now() - startTime}ms`);

      responseContent = completionResult.choices?.[0]?.message?.content ?? null;

      if (!responseContent) {
        const err = new Error('VLM response content is empty.');
        err.name = 'vlm response error';
        logger?.error(err);
        throw err;
      }

      logger?.info(
        `[UITarsModel.invoke] Attempting to parse prediction content as JSON...`,
      );
      try {
        const parsedPayload = json5.parse(responseContent);

        if (parsedPayload && typeof parsedPayload === 'object') {
          receivedSessionId = parsedPayload.session_id || null;
          logger?.info(
            `[UITarsModel.invoke] Received session ID from payload: ${receivedSessionId}`,
          );

          parsedActions = Array.isArray(parsedPayload.actions)
            ? parsedPayload.actions
            : [];

          if (!Array.isArray(parsedPayload.actions)) {
            logger?.warn(
              '[UITarsModel.invoke] Server response content payload did not contain a valid actions array.',
            );
          }
        } else {
          logger?.error(
            '[UITarsModel.invoke] Parsed prediction content is not a valid object:',
            parsedPayload,
          );
          parsedActions = [];
        }
      } catch (parseError: any) {
        logger?.error(
          '[UITarsModel.invoke] Failed to parse prediction content as JSON/JSON5:',
          responseContent,
          parseError,
        );
        parsedActions = [];
      }
    } catch (error: any) {
      logger?.error(
        '[UITarsModel.invoke] Error during model invocation:',
        error,
      );
      throw error;
    }

    return {
      prediction: responseContent || '',
      parsedPredictions: parsedActions,
      serverSessionId: receivedSessionId,
    };
  }
}
