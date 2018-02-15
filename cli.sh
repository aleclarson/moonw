
if [ -z `which moonc` ]; then
  echo "  `moonc` is missing, please install it."
  exit 1
fi

if [ -z `which node` ]; then
  echo "  `node` is missing, please install it."
  exit 1
fi

SELF_PATH=`readlink "$0"`
node "$(dirname $SELF_PATH)/index.js" $@
