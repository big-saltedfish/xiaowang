// @vitest-environment jsdom
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {useVoiceSession} from './useVoiceSession';
import {type QcaClient} from '../qca';
const mocks=vi.hoisted(()=>({start:vi.fn(),stop:vi.fn(async()=>{}),connect:vi.fn(),construct:vi.fn(),history:vi.fn()}));
vi.mock('./voiceApi',()=>({createRealtimeConversation:vi.fn(),getCompleteRealtimeConversationHistory:mocks.history,readRealtimeVoice:()=>null}));
vi.mock('./voiceAudio',()=>({MicrophoneCapture:class{start=mocks.start;stop=mocks.stop;},AudioPlayback:class{},handleVoicePlaybackEvent:()=>false}));
vi.mock('./voiceConnection',()=>({VoiceConnection:class{constructor(){mocks.construct();}connect=mocks.connect;disconnect=vi.fn();closeGracefully=vi.fn(async()=>({outcome:'closed'}));}}));
beforeEach(()=>{vi.clearAllMocks();mocks.history.mockResolvedValue({conversation:{id:'conv_existing'},events:[],page:{has_more:false,next_before:null}});});
afterEach(cleanup);
function options(){return {ctx:{api:{} as QcaClient},identityId:'idn_test',templateId:'tmpl_test',selectedVoice:'longanqian' as const,initialConversationId:'conv_existing',autoStart:false,launchKey:1,onConversationCreated:vi.fn(),onStartFailed:vi.fn()};}
void test('hangup while reconnect awaits microphone permission cannot revive the socket',async()=>{
 let release!:()=>void;mocks.start.mockImplementation(()=>new Promise<void>(r=>{release=r;}));
 const {result}=renderHook(()=>useVoiceSession(options()));await waitFor(()=>expect(result.current.stage).toBe('ended'));
 let reconnect!:Promise<void>;act(()=>{reconnect=result.current.continueConversation();});await waitFor(()=>expect(mocks.start).toHaveBeenCalled());
 await act(async()=>{await result.current.end();});await act(async()=>{release();await reconnect;});
 expect(mocks.construct).not.toHaveBeenCalled();expect(mocks.connect).not.toHaveBeenCalled();expect(result.current.stage).toBe('ended');
});
void test('history failure is returned to caller instead of disappearing on hangup',async()=>{
 const {result}=renderHook(()=>useVoiceSession(options()));await waitFor(()=>expect(result.current.stage).toBe('ended'));mocks.history.mockRejectedValueOnce(new Error('unavailable'));
 let warning:string|undefined;await act(async()=>{warning=(await result.current.end()).warning;});expect(warning).toMatch(/历史记录/);expect(result.current.historyWarning).toMatch(/历史记录/);
});
void test('history retry updates finished work without starting another conversation',async()=>{
 const {result}=renderHook(()=>useVoiceSession(options()));
 await waitFor(()=>expect(result.current.stage).toBe('ended'));
 mocks.history.mockRejectedValueOnce(new Error('unavailable'));
 await act(async()=>{await result.current.refreshHistory();});
 expect(result.current.historyWarning).toBeTruthy();
 mocks.history.mockResolvedValueOnce({conversation:{id:'conv_existing'},events:[{id:'done',type:'voice.work.completed',work_id:'work_1',status:'completed',objective:'研究进展',result:'报告已完成',occurred_at:'2026-09-13T12:00:00Z'}],page:{has_more:false,next_before:null}});
 await act(async()=>{await result.current.refreshHistory();});
 expect(result.current.historyWarning).toBeNull();
 expect(result.current.timeline).toEqual(expect.arrayContaining([expect.objectContaining({status:'completed',result:'报告已完成'})]));
 expect(mocks.construct).not.toHaveBeenCalled();
});
