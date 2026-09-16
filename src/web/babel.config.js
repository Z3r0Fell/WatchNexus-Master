module.exports = {
  presets: [
    ['react-app', { flow: false, typescript: false }],
  ],
  env: {
    test: {
      presets: [
        ['react-app', { flow: false, typescript: false }],
      ],
    },
  },
};