import { makeStyles, tokens, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
  wrapper: {
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: "100vh",
  },
  main: {
    ...shorthands.padding("24px"),
    maxWidth: "900px",
    ...shorthands.margin("0", "auto"),
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding("20px"),
    boxShadow: tokens.shadow4,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  header: {
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorBrandBackgroundPressed} 100%)`,
    ...shorthands.padding("20px", "24px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    marginBottom: "16px",
  },
  statsCard: {
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding("16px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    textAlign: "center",
  },
});

export const containerGap = "16px";
export const sectionGap = "12px";

