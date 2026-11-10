/** 720 逻辑宽度的视觉规范。来自三屏概念图的木色、羊皮纸、森林绿；仅调整可读性与美术，不参与业务。 */
export const C = {
    ink: "#48311f", muted: "#796348", cream: "#fff1cf", paper: "#eddbad",
    green: "#557637", gold: "#d49a35", red: "#af5338", grass: "#97af70", night: "#354f53",
    outline: "#493420", lightEdge: "#fff9e7"
};
/** 标题/正文/按钮按手机约一半缩放后的阅读尺寸设置；面板内容与分页同步使用同一列宽和行距。 */
export const UI = {
    body: 28, button: 30, title: 38, mapLabel: 24,
    panelWidth: 668, panelHeight: 860, panelX: 26, panelY: 184,
    inset: 34, contentWidth: 600, listSize: 5, listTop: 222, listStep: 98, listHeight: 86, footerTop: 780,
    pressedOffset: 4
} as const;
