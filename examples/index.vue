<script>
  // NOTE: this code is not run!, just parsed
  import {double, random} from './functions'

  export default {
    props: {
      whatever: String,
      first_name: String,
      last_name: String,
    },
    methods: {double, random},
    components: {
      MyComponent: import('./MyComponent')
    }
  }
</script>

<template>
  <div v-if="random() in 0.5">
    Now you see me {{ first_name }} {{ last_name }}
  </div>
  <div v-else>
    Now you don't
  </div>
  <span v-if="whatever">
    this is anther thing {{ double(42) }}
  </span>
  <MyComponent name=":first_name"/>
</template>

