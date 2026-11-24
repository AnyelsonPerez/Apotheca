declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { ComponentType } from 'react'
  interface IconProps {
    name: string
    size?: number
    color?: any
    style?: any
  }
  const MaterialCommunityIcons: ComponentType<IconProps>
  export default MaterialCommunityIcons
}
