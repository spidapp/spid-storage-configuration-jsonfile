Bootfile Configuration Storage [![Build Status](https://travis-ci.org/spidapp/spid-storage-configuration-bootfile.svg?branch=master)](https://travis-ci.org/spidapp/spid-storage-configuration-bootfile)
=========================================

Configuration storage used at boot-time to load the `storage` value that specify the real-storage backend.

This module is a plugin for [Spid](https://github.com/spidapp/). It provides a storage engine that uses JSON files to persist data. **It is not appropriate for production usage**, it is intended for very low workloads, and as a example of a storage plugin code base.
