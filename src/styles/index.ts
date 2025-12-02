import { IStackTokens, IStackStyles, mergeStyles } from "@fluentui/react";

export const containerStackTokens: IStackTokens = { childrenGap: 16 };
export const sectionStackTokens: IStackTokens = { childrenGap: 12 };

export const mainStyles: IStackStyles = {
  root: {
    padding: 24,
    maxWidth: 900,
    margin: "0 auto",
    backgroundColor: "#faf9f8",
    minHeight: "100vh",
  },
};

export const cardStyles: IStackStyles = {
  root: {
    backgroundColor: "white",
    padding: 20,
    boxShadow: "0 1.6px 3.6px 0 rgba(0,0,0,0.132), 0 0.3px 0.9px 0 rgba(0,0,0,0.108)",
    borderRadius: 4,
  },
};

export const headerClass = mergeStyles({
  background: "linear-gradient(135deg, #0078d4 0%, #106ebe 100%)",
  padding: "20px 24px",
  borderRadius: 4,
  marginBottom: 16,
});

export const statsCardClass = mergeStyles({
  backgroundColor: "#f3f2f1",
  padding: 16,
  borderRadius: 4,
  textAlign: "center",
});
