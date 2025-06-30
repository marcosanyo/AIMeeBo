const themes = {
  light: {
    bg: 'bg-gradient-to-br from-slate-50 via-sky-100 to-indigo-100',
    header: 'bg-white/70 backdrop-blur-lg border border-slate-200 shadow-sm rounded-xl',
    card: 'bg-white/80 backdrop-blur-lg border border-slate-200 shadow-lg rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all duration-300',
    cardInner: 'bg-sky-50/70 border border-slate-300 rounded-xl shadow-sm',
    border: 'border-slate-200',
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      tertiary: 'text-gray-500',
      muted: 'text-gray-400'
    },
    input: 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 rounded-lg shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200',
    button: {
      primary: 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md hover:from-sky-600 hover:to-indigo-600 hover:shadow-lg rounded-lg',
      secondary: 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md hover:from-emerald-600 hover:to-green-600 hover:shadow-lg rounded-lg',
      danger: 'bg-rose-100 text-rose-600 border border-rose-300 hover:bg-rose-200 hover:text-rose-700 rounded-lg'
    },
    dropzone: 'border-2 border-dashed border-sky-300 bg-sky-50/70 rounded-xl transition-all duration-200',
    dropzoneActive: 'border-sky-500 bg-sky-200 shadow-lg scale-[1.02] border-4 ring-2 ring-sky-400 ring-opacity-50'
  },
  dark: {
    bg: 'bg-gradient-to-br from-gray-900 via-gray-800 to-black',
    header: 'bg-gray-800/90 backdrop-blur-md border border-gray-600 shadow-md rounded-xl',
    card: 'bg-gray-800/90 backdrop-blur-md border border-gray-600 shadow-md rounded-2xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300',
    cardInner: 'bg-gray-700/70 border border-gray-500 rounded-xl shadow-sm',
    border: 'border-gray-600',
    text: {
      primary: 'text-gray-100',
      secondary: 'text-gray-300',
      tertiary: 'text-gray-400',
      muted: 'text-gray-500'
    },
    input: 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400',
    button: {
      primary: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
      secondary: 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800',
      danger: 'bg-red-900/30 text-red-300 border-red-800 hover:bg-red-900/50'
    },
    dropzone: 'border-2 border-dashed border-gray-500 bg-gray-700/30 transition-all duration-200',
    dropzoneActive: 'border-emerald-400 bg-emerald-600/40 shadow-lg scale-[1.02] border-4 ring-2 ring-emerald-400 ring-opacity-50'
  },
  modern: {
    bg: 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900',
    header: 'bg-white/10 backdrop-blur-md border border-white/30 shadow-md rounded-xl',
    card: 'bg-white/10 backdrop-blur-md border border-white/30 shadow-md rounded-2xl hover:shadow-lg hover:-translate-y-1 hover:bg-white/15 transition-all duration-300',
    cardInner: 'bg-white/10 border border-white/20 rounded-xl shadow-sm',
    border: 'border-white/30',
    text: {
      primary: 'text-white',
      secondary: 'text-white/70',
      tertiary: 'text-white/50',
      muted: 'text-white/40'
    },
    input: 'bg-white/5 border-white/20 text-white placeholder-white/50',
    button: {
      primary: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
      secondary: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
      danger: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
    },
    dropzone: 'border-2 border-dashed border-white/30 bg-white/5 transition-all duration-200',
    dropzoneActive: 'border-amber-300 bg-amber-500/40 shadow-lg scale-[1.02] border-4 ring-2 ring-amber-300 ring-opacity-60'
  }
};

export { themes };
