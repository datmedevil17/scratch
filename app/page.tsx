'use client';

import { useState } from "react";
import { ScratchHeader } from "@/components/scratch/header";
import { BlockPalette } from "@/components/scratch/block-palette";

export default function Home() {
  const [isRunning, setIsRunning] = useState(false);
  const [projectName, setProjectName] = useState("My First Project");
  const [user, setUser] = useState<{ name: string; avatar?: string } | null>(null);

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      <ScratchHeader
        projectName={projectName}
        onProjectNameChange={setProjectName}
        isRunning={isRunning}
        onRun={() => setIsRunning(true)}
        onStop={() => setIsRunning(false)}
        onNew={() => {
          setProjectName("Untitled Project");
          setIsRunning(false);
        }}
        onSave={() => alert("Save triggered")}
        onLoad={() => alert("Load triggered")}
        onExport={() => alert("Export triggered")}
        onFullscreen={() => document.documentElement.requestFullscreen?.()}
        onShare={() => alert("Share triggered")}
        user={user}
        onLogin={() =>
          setUser({ name: "ScratchDev", avatar: undefined })
        }
        onLogout={() => setUser(null)}
      />

      {/* Editor area */}
      <main className="flex min-h-0 flex-1 overflow-hidden">
        <BlockPalette />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Editor canvas will go here
        </div>
      </main>
    </div>
  );
}
