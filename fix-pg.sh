#!/bin/bash
sed -i "s/listen_addresses = '\*'/listen_addresses = 'localhost'/" /etc/postgresql/17/main/postgresql.conf
systemctl reload postgresql
echo "PG restringido a localhost OK"
grep listen_addresses /etc/postgresql/17/main/postgresql.conf
