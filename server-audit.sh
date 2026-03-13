#!/bin/bash
echo "=== PG TABLES ==="
sudo -u postgres psql sisrestaurantes -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
echo "=== PG TRANSACTIONS ==="
sudo -u postgres psql -c "SELECT datname, xact_commit+xact_rollback as total_tx FROM pg_stat_database WHERE datname='sisrestaurantes';"
echo "=== PG MEMORY ==="
sudo -u postgres psql -c "SHOW shared_buffers;"
echo "=== DOCKER DANGLING ==="
docker images -f dangling=true -q | wc -l
echo "=== DISK BREAKDOWN ==="
du -sh /var/lib/docker/ /var/lib/postgresql/ /opt/ 2>/dev/null
