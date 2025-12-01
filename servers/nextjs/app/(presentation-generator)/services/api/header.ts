import { getUserId } from "@/app/(presentation-generator)/services/user-id";

export const getHeader = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
  };

  const userId = getUserId();
  if (userId) {
    headers["X-User-Id"] = userId;
  }

  return headers;
};

export const getHeaderForFormData = () => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
  };

  const userId = getUserId();
  if (userId) {
    headers["X-User-Id"] = userId;
  }

  return headers;
};
