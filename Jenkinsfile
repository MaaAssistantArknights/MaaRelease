podTemplate(
  containers: [
    containerTemplate(
        name: 'worker',
        image: 'node:lts-alpine',
        ttyEnabled: true, 
        command: 'cat',
        envVars: [
            containerEnvVar(key: 'THREAD', value: '4'),
            containerEnvVar(key: 'OWNER', value: 'MaaAssistantArknights'),
            containerEnvVar(key: 'MINIO_BUCKET', value: 'maa-release'),
            containerEnvVar(key: 'MINIO_ENDPOINT_DOMAIN', value: 'minio.local'),
            containerEnvVar(key: 'MINIO_ENDPOINT_PORT', value: '9080'),
            containerEnvVar(key: 'MINIO_WAIT_TIME_AFTER_UPLOAD_MS', value: '1000')
        ]
    )
  ]
) {
  node(POD_LABEL) {
    environment {
      RELEASE_TAG = params.customParam
    }    

    parameters {
        string(name: 'release_tag', defaultValue: '', description: 'Release tag (defaults to the tag of the release event)')
    }

    stage('Checkout Repo') {
      container('worker') {
        sh 'apk --no-cache update'
        sh 'apk add git'
        sh 'git clone https://github.com/MaaAssistantArknights/MaaRelease.git'
      }
    }

    stage('Install the dependencies') {
      container('worker') {
        sh 'cd MaaRelease/scripts && npm ci'
      }
    }

    stage('Download files from GitHub Release and upload files to Minio') {
      withCredentials([
          string(credentialsId: 'maa-jenkins-robot-token', variable: 'GITHUB_PAT'),
          string(credentialsId: 'maa-minio-robot-access-key', variable: 'MINIO_ACCESS_KEY'),
          string(credentialsId: 'maa-minio-robot-secret-key', variable: 'MINIO_SECRET_KEY')
      ]) {
          container('worker') {
            sh 'cd MaaRelease/scripts && node s3-sync/index.js'
          }
      }
      
    }
  }
}
