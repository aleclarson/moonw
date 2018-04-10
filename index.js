let {ReadStream, WriteStream} = require('fs')
let chokidar = require('chokidar')
let moonc = require('moonc')
let path = require('path')
let fs = require('fsx')

let huey = require('huey')
let log = huey.log(function() {
  console.log(...arguments)
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
  let file = get_arg('-c')
  if (file) {
    file = path.resolve(src, file)
    fs.isFile(file) && transpile(file)
  } else {
    watch()
  }
} else {
  fatal('invalid src directory: ' + src)
}

//
// Helpers
//

function get_dest(file, ext) {
  if (ext) {
    let old_ext = path.extname(file)
    if (old_ext) file = file.slice(0, -old_ext.length)
    file += ext
  }
  let rel = path.relative(src, file)
  return path.join(dest, rel)
}

function transpile(file) {
  if (file.endsWith('.moon')) {
    // Read from the given file path.
    let input = new ReadStream(file)
      .once('error', onError)

    // Write to the resolved dest path.
    let dest = new WriteStream(get_dest(file, '.lua'))
      .once('error', onError)

    let failed = false

    // Transpile in between read and write.
    moonc(input).on('error', (err) => {
      failed = true
      if (err.name == 'SyntaxError') {
        let rel = path.relative(process.cwd(), file)
        let msg = huey.red(rel) + '\n' + err.message
        dest.write(`print([[\n\n${msg}]])\nrequire('os').exit()`)
        log(`\n${msg}\n`)
      } else {
        onError(err)
      }
    }).pipe(dest).once('finish', () => {
      if (failed) return
      log.green('transpiled:', path.relative(process.cwd(), file))
    })
  } else {
    // Copy all other file types.
    fs.copy(file, get_dest(file))
  }
}

function watch() {
  let events = {
    add: transpile,
    change: transpile,
    unlink(file) {
      let ext = file.endsWith('.moon') ? '.lua' : null
      log.red('unlink:', path.relative(process.cwd(), file))
      fs.removeFile(get_dest(file, ext))
    },
    addDir: (dir) => fs.writeDir(get_dest(dir)),
    unlinkDir: (dir) => fs.removeDir(get_dest(dir)),
  }
  log.cyan('Watching for changes...')
  return chokidar.watch(src + '/**/*', {
    ignored: ['**/.DS_Store', '**/*.swp'],
  }).on('all', (event, file) => {
    events[event](file)
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

function fatal() {
  log.red(...arguments)
  process.exit(1)
}

function onError(err) {
  let msg = err.constructor.name + ': ' + err.message
  log.red(msg, err.stack.slice(msg.length))
}
