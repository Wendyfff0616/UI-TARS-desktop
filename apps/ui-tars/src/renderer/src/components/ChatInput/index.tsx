/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
// import { chatCompletions } from '@renderer/api';
import { IMAGE_PLACEHOLDER } from '@ui-tars/shared/constants';
import { StatusEnum } from '@ui-tars/shared/types';
import { useStore } from '@renderer/hooks/useStore';
import { api } from '@renderer/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@renderer/components/ui/tooltip';
import { Button } from '@renderer/components/ui/button';
import { Play, Send, Square, Loader2 } from 'lucide-react';
import { Textarea } from '@renderer/components/ui/textarea';
import { SelectOperator } from './SelectOperator';
import { useSessionStore } from '../../store/session';

const ChatInput: React.FC = () => {
  const { status, instructions: savedInstructions, messages } = useStore();
  const [localInstructions, setLocalInstructions] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const running = status === StatusEnum.RUNNING;
  const isCallUser = useMemo(() => status === StatusEnum.CALL_USER, [status]);

  // Determine which instructions to send
  const getInstantInstructions = (): string => {
    if (localInstructions.trim()) return localInstructions;
    if (isCallUser && savedInstructions?.trim()) return savedInstructions;
    return '';
  };

  // Trigger agent run (sessionId & instructions auto-injected in API wrapper)
  const startRun = async () => {
    const instructions = getInstantInstructions();
    if (!instructions) return;

    console.log(
      'BEFORE runAgent, store.sid =',
      useSessionStore.getState().currentServerSessionId,
    );

    // ✔️ 直接调用 api.runAgent，它会
    //  1) 从 store 里读旧 sessionId
    //  2) 发给主进程 → HTTP 请求 → 拿到 newSessionId + data.messages
    //  3) 自动把 assistant 消息写入 Zustand，更新 sessionId
    const newSid = await api.runAgent({ instructions });

    console.log('AFTER runAgent, store.sid =', newSid);
    setLocalInstructions('');
  };

  // Handle Enter key for submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.metaKey &&
      getInstantInstructions()
    ) {
      e.preventDefault();
      startRun();
    }
  };

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Determine placeholder: saved instructions, last human message, or default prompt
  const lastHumanMessage =
    [...messages]
      .reverse()
      .find((m) => m.from === 'human' && m.value !== IMAGE_PLACEHOLDER)
      ?.value || '';

  // Stop & clear
  const stopRun = async () => {
    await api.stopRun();
    await api.clearHistory();
  };

  // Render send/stop/play button based on state
  const renderButton = () => {
    if (running) {
      return (
        <Button variant="secondary" size="icon" onClick={stopRun}>
          <Square className="h-4 w-4" />
        </Button>
      );
    }
    if (isCallUser && !localInstructions) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="bg-pink-100 hover:bg-pink-200 text-pink-500 border-pink-200"
                onClick={startRun}
                disabled={!getInstantInstructions()}
              >
                <Play className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="whitespace-pre-line">
                Send last instructions when UI-TARS asks for CALL_USER
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <Button
        variant="secondary"
        size="icon"
        onClick={startRun}
        disabled={!getInstantInstructions()}
      >
        <Send className="h-4 w-4" />
      </Button>
    );
  };

  return (
    <div className="p-4 w-full">
      <div className="flex flex-col space-y-4">
        <div className="relative w-full">
          <Textarea
            ref={textareaRef}
            placeholder={
              isCallUser && savedInstructions
                ? savedInstructions
                : running && lastHumanMessage && messages.length > 1
                  ? lastHumanMessage
                  : 'What can I do for you today?'
            }
            className="min-h-[120px] rounded-2xl resize-none px-4 pb-16"
            value={localInstructions}
            disabled={running}
            onChange={(e) => setLocalInstructions(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {!localInstructions && !running && (
            <span className="absolute right-4 top-4 text-xs text-muted-foreground">
              `Enter` to run
            </span>
          )}
          <SelectOperator />
          <div className="absolute right-4 bottom-4 flex items-center gap-2">
            {running && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {renderButton()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
