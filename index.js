let {WriteStream} = require('fs')
let {spawn} = require('child_process')
let chokidar = require('chokidar')
let path = require('path')
let fs = require('fsx')

let huey = require('huey')
Object.keys(huey).forEach(key => {
  let color = huey[key]
  print[key] = (m) => print(color(m))
})

let argv = process.argv.slice(2)

let src = argv[0]
if (!src || src[0] == '-') {
  fatal('must provide src directory')
}

let dest = get_arg('-o')
if (!dest) {
  fatal('missing -o argument')
}
dest = path.join(process.cwd(), dest)
if (!fs.exists(dest)) {
  fs.writeDir(dest)
} else if (!fs.isDir(dest)) {
  fatal('invalid dest directory: ' + dest)
}

src = path.join(process.cwd(), src)
if (fs.isDir(src)) {
  watch()
} else {
  fatal('invalid src directory: ' + src)
}

//
// Helpers
//

function get_dest(file) {
  let rel = path.relative(src, file)
  return path.join(dest, rel)
}

function transpile(file) {
  let dest = new WriteStream(get_dest(file))
  let proc = spawn('moonc', [file, '-p'])
  proc.stdout.on('data', (data) => dest.write(data))
}

function watch() {
  let loading = true
  let events = {
    add: transpile,
    change: transpile,
    unlink: (file) => fs.removeFile(get_dest(file)),
    addDir: noop,
    unlinkDir: noop,
  }
  return chokidar.watch(src + '/**/*', {
    ignored: ['**/.DS_Store', '**/*.swp'],
  }).on('all', (event, file) => {
    print(huey.green(event + ': ') + file)
    events[event](file)
  }).once('ready', () => {
    loading = false
    events.addDir = (dir) =>
      fs.writeDir(get_dest(file))
    events.unlinkDir = (dir) =>
      fs.removeDir(get_dest(file))
  })
}

function get_arg(flag) {
  let i = argv.indexOf(flag)
  if (i > -1) {
    let arg = argv[i + 1]
    if (arg && arg[0] != '-') {
      return arg
    }
  }
}

function print(m) {
  console.log(m)
}

function fatal(m) {
  print.red(m)
  process.exit(1)
}

function noop() {}
