'use client';
import { FolderOpen, Brain } from 'lucide-react';
import './research-assets.css';

export function ResearchAssets({ onReports, onMemory }: { onReports: () => void; onMemory: () => void }) {
  return <div className="research-assets" aria-label="研究积累">
    <button onClick={onReports}>
      <FolderOpen aria-hidden="true" />
      <span><strong>研究档案 <small>Drive</small></strong><span>每轮报告、来源与复盘，随时翻阅和追问。</span></span>
    </button>
    <button onClick={onMemory}>
      <Brain aria-hidden="true" />
      <span><strong>经验手册 <small>Memory</small></strong><span>记住偏好与待查问题，让下一轮接着做。</span></span>
    </button>
  </div>;
}
