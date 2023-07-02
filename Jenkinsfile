podTemplate(
  containers: [
    containerTemplate(name: 'worker', image: 'node:lts-alpine', command: 'sleep', args: '1h')
  ]
) {
  node(POD_LABEL) {
    environment {
      RELEASE_TAG = params.release_tag
    }    

    parameters {
        string(name: 'release_tag', defaultValue: '', description: 'Release tag (defaults to the tag of the release event)')
    }

    stage('Checkout Repo') {
      container('worker') {
        dir('/tmp') {
          git branch: 'main', url: 'https://github.com/MaaArknightsAssistant/MaaRelease.git'
        }
      }
    }

    stage('Install the dependencies') {
      container('worker') {
        dir('/tmp/MaaRelease/scripts') {
          sh 'npm ci'
        }
      }
    }

    stage('Download files from GitHub Release and upload files to Minio') {
      container('worker') {
        environment {
          GITHUB_PAT = credentials('maa-jenkins-robot-token')
          THREAD = '4'
          UPLOAD_DIR = 'MaaAssistantArknights/MaaRelease/releases/download'
          MINIO_BUCKET = 'maa-release'
          MINIO_ENDPOINT = 'minio.local'
          MINIO_ENDPOINT_PORT = '9080'
          MINIO_ACCESS_KEY = credentials('maa-minio-robot-access-key')
          MINIO_SECRET_KEY = credentials('maa-minio-robot-secret-key')
        }
        dir('/tmp/MaaRelease/scripts') {
          sh 'node s3-sync/index.js'
        }
      }
    }
  }
}
