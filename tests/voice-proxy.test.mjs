import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import WebSocket,{WebSocketServer} from 'ws';
import {createVoiceProxy} from '../server/voiceProxy.mjs';

void test('voice proxy authenticates once, keeps credentials out of the URL and relays both directions',async()=>{
 const upstreamHttp=createServer();const upstream=new WebSocketServer({server:upstreamHttp});await new Promise(r=>upstreamHttp.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${upstreamHttp.address().port}/api/v1/forward`;
 const proxy=createVoiceProxy({baseUrls:{'global-prod':base,'cn-prod':base},allowLocal:false,allowedOrigins:['http://localhost:5178']});const server=createServer();proxy.attach(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let captured;const upstreamMessages=[];
 upstream.on('connection',(socket,req)=>{captured={url:req.url,auth:req.headers.authorization};socket.send('ready');socket.on('message',data=>{upstreamMessages.push(data.toString());socket.send(data);});});
 const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/api/voice/socket`,{headers:{Origin:'http://localhost:5178'}});
 try{await once(socket,'open');const ready=once(socket,'message');socket.send(JSON.stringify({type:'proxy.auth',pat:'test-secret',environment:'global-prod',conversation_id:'conv_test'}));assert.equal((await ready)[0].toString(),'ready');assert.equal(captured.auth,'Bearer test-secret');assert.equal(captured.url,'/api/v1/forward/realtime?conversation_id=conv_test');assert.ok(!captured.url.includes('test-secret'));
 const reply=once(socket,'message');socket.send('hello');assert.equal((await reply)[0].toString(),'hello');assert.deepEqual(upstreamMessages,['hello']);
 }finally{socket.terminate();for(const c of upstream.clients)c.terminate();await new Promise(r=>server.close(r));await new Promise(r=>upstream.close(r));await new Promise(r=>upstreamHttp.close(r));}
});
void test('voice proxy rejects unrelated web origins before requesting authentication',async()=>{
 const server=createServer();createVoiceProxy({baseUrls:{'global-prod':'https://api.qoder.com/api/v1/forward','cn-prod':'https://api.qoder.com.cn/api/v1/forward'},allowLocal:false,allowedOrigins:['http://localhost:5178']}).attach(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/api/voice/socket`,{headers:{Origin:'https://unrelated.example'}});
 try{const [error]=await once(socket,'error');assert.match(error.message,/403/);}finally{socket.terminate();await new Promise(r=>server.close(r));}
});
