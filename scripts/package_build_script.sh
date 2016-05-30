#!/bin/bash

#
# This script builds Rev LogShipping Service Debian package
#

if [ -z "$WORKSPACE" ]; then
	echo "ERROR: WORKSPACE env. variable is not set"
	exit 1
fi

if [ -z "$BUILD_NUMBER" ]; then
	echo "ERROR: BUILD_NUMBER env. variable is not set"
	exit 1
fi

if [ -z "$VERSION" ]; then
	VERSION=1.0.$BUILD_NUMBER
	echo "INFO: VERSION env variable is not set - setting it to $VERSION"
fi

PACKAGENAME=revsw-logshipper

PACKAGEDIR=packages

if [ ! -d $PACKAGEDIR ]; then
	echo "INFO: Directory $PACKAGEDIR does not exist - creating it..."
	mkdir $PACKAGEDIR
	if [ $? -ne 0 ]; then
		echo "ERROR: Failed to create directory $PACKAGEDIR - aborting"
		exit 1
	fi
fi

WORKDIR="package_build_dir"

sudo rm -rf $WORKDIR
mkdir $WORKDIR
cd $WORKDIR

if [ $? -ne 0 ]; then
  echo "FATAL: Failed to CD to directory $WORKDIR"
  exit 1
fi


foldername=$PACKAGENAME'_'$VERSION

mkdir -p $foldername/DEBIAN
touch $foldername/DEBIAN/control

PackageName=$PACKAGENAME
PackageVersion=$VERSION
MaintainerName="Victor Gartvich"
MaintainerEmail=victor@revsw.com

echo "Package: $PackageName
Version: $PackageVersion
Architecture: amd64
Maintainer: $MaintainerName <$MaintainerEmail>
Section: unknown
Priority: extra
Homepage: www.revapm.com
Description: Rev LogShipping Service" >> $foldername/DEBIAN/control

mkdir -p $foldername/etc/init.d  $foldername/etc/logrotate.d
mkdir -p $foldername/etc/rsyslog.d
cp -rp $WORKSPACE/scripts/init.d_revsw-logshipper  $foldername/etc/init.d/revsw-logshipper
cp -rp $WORKSPACE/scripts/logrotate_revsw-logshipper $foldername/etc/logrotate.d/revsw-logshipper
# cp -rp $WORKSPACE/scripts/syslog-logshipper.conf $foldername/etc/rsyslog.d/logshipper.conf

mkdir -p $foldername/opt/$PackageName/config
mkdir -p $foldername/opt/$PackageName/uploads

cp -rf  $WORKSPACE/bin  $foldername/opt/$PackageName/
cp -rf  $WORKSPACE/lib  $foldername/opt/$PackageName/
cp -rf  $WORKSPACE/handlers  $foldername/opt/$PackageName/
cp -rf  $WORKSPACE/routes  $foldername/opt/$PackageName/
cp -rf  $WORKSPACE/node_modules  $foldername/opt/$PackageName/
cp -rf  $WORKSPACE/config/*.json  $foldername/opt/$PackageName/config/
cp -rf  $WORKSPACE/config/dev_ssl_certs  $foldername/opt/$PackageName/config/
cp -rf  $WORKSPACE/config/version.txt  $foldername/opt/$PackageName/config
cp -rf  $WORKSPACE/package.json $foldername/opt/$PackageName/

mkdir -p $foldername/opt/$PackageName/log

sudo chown -R root:root $foldername

dpkg -b $foldername $WORKSPACE/$PACKAGEDIR/$foldername.deb

