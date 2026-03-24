self.EZLog = {
  bg(...args) {
    console.log("%c[BG]", "color: #4FC3F7; font-weight: bold;", ...args);
  },
  cs(...args) {
    console.log("%c[CS]", "color: #81C784; font-weight: bold;", ...args);
  },
  popup(...args) {
    console.log("%c[POPUP]", "color: #FFB74D; font-weight: bold;", ...args);
  },
  error(...args) {
    console.log("%c[ERROR]", "color: #E57373; font-weight: bold;", ...args);
  }
};
