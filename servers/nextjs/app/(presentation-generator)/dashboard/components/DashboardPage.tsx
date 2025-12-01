"use client";

import React, { useState, useEffect } from "react";

import Wrapper from "@/components/Wrapper";
import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { PresentationGrid } from "@/app/(presentation-generator)/dashboard/components/PresentationGrid";


import Header from "@/app/(presentation-generator)/dashboard/components/Header";

const DashboardPage: React.FC = () => {
  const [presentations, setPresentations] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      await fetchPresentations();
    };
    loadData();
  }, []);

  const fetchPresentations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await DashboardApi.getPresentations();
      data.sort(
        (a: any, b: any) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setPresentations(data);
    } catch (err) {
      setError(null);
      setPresentations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const removePresentation = (presentationId: string) => {
    setPresentations((prev: any) =>
      prev ? prev.filter((p: any) => p.id !== presentationId) : []
    );
  };

  return (
    <div className="min-h-screen bg-[#E9E8F8]">
      <Header />
      <Wrapper>
        <main className="container mx-auto px-4 py-8">
          <section>
            <h2 className="text-2xl font-roboto font-medium mb-4">
              演示文稿
            </h2>
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <span className="font-medium">提示：</span>
              您的数据通过浏览器标识保存，无法跨设备同步。清除浏览器缓存或更换浏览器将无法访问之前创建的演示文稿。
            </div>
            <PresentationGrid
              presentations={presentations}
              type="slide"
              isLoading={isLoading}
              error={error}
              onPresentationDeleted={removePresentation}
            />
          </section>
        </main>
      </Wrapper>
    </div>
  );
};

export default DashboardPage;
