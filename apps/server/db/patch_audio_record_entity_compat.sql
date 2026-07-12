-- Compatibility patch for audio_record after the TypeORM entity moved to snake_case columns.
-- Safe to run repeatedly. It adds every column currently read by AudioRecordEntity
-- and copies data from legacy camelCase columns when they exist.

ALTER TABLE audio_record
  ADD COLUMN IF NOT EXISTS tenant_id varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS device_no varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS user_id integer NULL,
  ADD COLUMN IF NOT EXISTS file_name varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS chunk_index integer NULL,
  ADD COLUMN IF NOT EXISTS segment_type varchar(1) NULL,
  ADD COLUMN IF NOT EXISTS oss_key varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS file_url varchar(1000) NULL,
  ADD COLUMN IF NOT EXISTS size_bytes bigint NULL,
  ADD COLUMN IF NOT EXISTS start_time timestamp NULL,
  ADD COLUMN IF NOT EXISTS end_time timestamp NULL,
  ADD COLUMN IF NOT EXISTS transcribe_status varchar(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS asr_status varchar(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS isolation_status varchar(32) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS isolation_reason varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS transcript_text text NULL,
  ADD COLUMN IF NOT EXISTS transcript_raw text NULL,
  ADD COLUMN IF NOT EXISTS status char(1) NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS del_flag char(1) NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS create_by varchar(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS create_time timestamp DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS update_by varchar(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS update_time timestamp DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS remark varchar(500) NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'tenantId') THEN
    EXECUTE 'UPDATE audio_record SET tenant_id = "tenantId" WHERE tenant_id IS NULL AND "tenantId" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'deviceNo') THEN
    EXECUTE 'UPDATE audio_record SET device_no = "deviceNo" WHERE device_no IS NULL AND "deviceNo" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'userId') THEN
    EXECUTE 'UPDATE audio_record SET user_id = "userId" WHERE user_id IS NULL AND "userId" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'fileName') THEN
    EXECUTE 'UPDATE audio_record SET file_name = "fileName" WHERE file_name IS NULL AND "fileName" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'chunkIndex') THEN
    EXECUTE 'UPDATE audio_record SET chunk_index = "chunkIndex" WHERE chunk_index IS NULL AND "chunkIndex" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'segmentType') THEN
    EXECUTE 'UPDATE audio_record SET segment_type = "segmentType" WHERE segment_type IS NULL AND "segmentType" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'ossKey') THEN
    EXECUTE 'UPDATE audio_record SET oss_key = "ossKey" WHERE oss_key IS NULL AND "ossKey" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'fileUrl') THEN
    EXECUTE 'UPDATE audio_record SET file_url = "fileUrl" WHERE file_url IS NULL AND "fileUrl" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'sizeBytes') THEN
    EXECUTE 'UPDATE audio_record SET size_bytes = "sizeBytes" WHERE size_bytes IS NULL AND "sizeBytes" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'startTime') THEN
    EXECUTE 'UPDATE audio_record SET start_time = "startTime" WHERE start_time IS NULL AND "startTime" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'endTime') THEN
    EXECUTE 'UPDATE audio_record SET end_time = "endTime" WHERE end_time IS NULL AND "endTime" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'transcribeStatus') THEN
    EXECUTE 'UPDATE audio_record SET transcribe_status = "transcribeStatus" WHERE "transcribeStatus" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'asrStatus') THEN
    EXECUTE 'UPDATE audio_record SET asr_status = "asrStatus" WHERE "asrStatus" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'isolationStatus') THEN
    EXECUTE 'UPDATE audio_record SET isolation_status = "isolationStatus" WHERE "isolationStatus" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'isolationReason') THEN
    EXECUTE 'UPDATE audio_record SET isolation_reason = "isolationReason" WHERE isolation_reason IS NULL AND "isolationReason" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'transcriptText') THEN
    EXECUTE 'UPDATE audio_record SET transcript_text = "transcriptText" WHERE transcript_text IS NULL AND "transcriptText" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'transcriptRaw') THEN
    EXECUTE 'UPDATE audio_record SET transcript_raw = "transcriptRaw" WHERE transcript_raw IS NULL AND "transcriptRaw" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'delFlag') THEN
    EXECUTE 'UPDATE audio_record SET del_flag = "delFlag" WHERE "delFlag" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'createBy') THEN
    EXECUTE 'UPDATE audio_record SET create_by = "createBy" WHERE "createBy" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'createTime') THEN
    EXECUTE 'UPDATE audio_record SET create_time = "createTime" WHERE "createTime" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'updateBy') THEN
    EXECUTE 'UPDATE audio_record SET update_by = "updateBy" WHERE "updateBy" IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audio_record' AND column_name = 'updateTime') THEN
    EXECUTE 'UPDATE audio_record SET update_time = "updateTime" WHERE "updateTime" IS NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audio_record_device_no_start_time ON audio_record (device_no, start_time);
CREATE INDEX IF NOT EXISTS idx_audio_record_user_id_start_time ON audio_record (user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_audio_record_file_name ON audio_record (file_name);
