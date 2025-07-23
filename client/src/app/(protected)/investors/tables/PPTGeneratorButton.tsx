"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { usePPTGenerator } from "../report/usePPTGenerator";

interface Props {
    defaultInvestor: string;
    fundId?: number;
    className?: string;  
}

export default function PPTGeneratorButton({ defaultInvestor, fundId, className }: Props) {
    const { isGenerating, handleGeneratePpt } = usePPTGenerator({ defaultInvestor, fundId });

    return (
        <Button
            onClick={handleGeneratePpt}
            disabled={isGenerating}
            variant="default"  
            title={`Download PPT report for ${defaultInvestor}`}
            className={
                `flex items-center gap-2 transition` +
                (isGenerating ? " animate-pulse cursor-wait" : "") +
                (className ? ` ${className}` : "")   
            }
        >
            <Download className="h-4 w-4" />
            {isGenerating ? "Generating PPT Report…" : "Download PPT Report"}
        </Button>
    );
}